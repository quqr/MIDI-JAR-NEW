<template>
  <div class="relative h-full overflow-hidden" :class="backgroundClass">
    <!--
      谱面视口容器（Canvas 图元缓存版，见 ADR 0010）：
      - 谱面绘制在单一 canvas 上：每帧只重绘可见窗口内的图元，
        DOM 归零（SVG 解析后即从 OSMD 容器摘除），任意缩放矢量无损
      - 平移/缩放是渲染参数（ctx.setTransform），无 DOM transform 层
      - 扫描线与渐显画进 canvas（导出画面自带播放指示）
      - 拖拽：内容跟随光标 + 惯性滑行（自然衰减，无边界停止）
      - 重绘按需驱动：播放每帧、静止时仅交互/设置变化触发，无空转循环
    -->
    <div
      ref="scrollEl"
      class="absolute inset-0 overflow-hidden select-none"
      :class="dragCursorClass"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @contextmenu="onContextMenu"
      @wheel="onWheel"
    >
      <canvas ref="canvasEl" class="absolute left-0 top-0"></canvas>
      <!--
        OSMD 渲染容器（图元解析数据源）：
        渲染产出的 SVG 节点被解析为图元后立即从 DOM 摘除，此容器常态为空。
        固定定位移出屏幕且保持非 display:none——OSMD/VexFlow 的
        getBBox/measureText 需要元素参与布局才能度量。
      -->
      <div ref="osmdEl" class="score-osmd-source" aria-hidden="true"></div>
    </div>

    <!-- 缩放控件 -->
    <div
      class="absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-xl border border-base-content/10 bg-base-100/90 px-1 py-1"
    >
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :title="t('scoreScroll.appearance.title')"
        :aria-label="'zoom-out'"
        @click="emit('update:zoom', zoomBy(zoom, 1 / ZOOM_STEP_FACTOR))"
      >
        <Icon name="minus" :size="14" aria-hidden="true" />
      </button>
      <span
        class="min-w-14 text-center text-xs tabular-nums text-base-content/70"
      >
        {{ zoomLabel }}
      </span>
      <button
        class="btn btn-xs btn-circle btn-ghost"
        :aria-label="'zoom-in'"
        @click="emit('update:zoom', zoomBy(zoom, ZOOM_STEP_FACTOR))"
      >
        <Icon name="plus" :size="14" aria-hidden="true" />
      </button>
    </div>

    <!-- 加载中（不透明遮罩：渲染+图元解析全程覆盖，完成后谱面一次性完整显现） -->
    <div
      v-if="loading"
      class="absolute inset-0 z-20 flex items-center justify-center bg-base-100"
    >
      <LoadingSpinner :label="t('scoreScroll.source.parsing')" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 谱面视口（单行横向连续视图，Canvas 图元缓存版）
 *
 * 性能策略：
 * 1. OSMD 固定 zoom = 1 渲染 SVG，解析为图元缓存后丢弃 DOM；
 *    缩放由 ctx.setTransform 完成（0.01x - 50x），矢量重绘无损
 * 2. 每帧只绘制可见窗口内的图元（分桶索引二分裁剪），零 DOM 变动
 * 3. 重绘按需驱动（dirty + rAF 合并），播放推进每帧触发，
 *    静止时仅拖拽/缩放/设置/解析进度变化触发
 * 4. 扫描线/渐显为绘制参数（画进 canvas），无 overlay DOM 层
 *
 * 坐标系约定（与原 DOM 方案一致）：
 * - OSMD 内容坐标（useScoreSync 传入的 x）为"未缩放内容坐标"
 * - 显示位置 = pan + (contentOffset + x) × zoom
 * - panX/panY 无边界（无限平移）
 */
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import Icon from "@/components/Icon/Icon.vue";
import type { PrimitiveIndex } from "../utils/primitives";
import {
  backingStoreSize,
  drawScoreFrame,
  type FlyInEffect,
  type GlowEffect,
  type RevealDraw,
  type ScanlineDraw,
  type ScoreContext2D,
} from "../utils/scoreCanvasRenderer";
import type {
  ScoreBackgroundStyle,
  ScoreNoteInfo,
  ScorePlaybackState,
} from "../types";

const props = defineProps<{
  zoom: number;
  /** 扫描线在视口内的水平位置（0-100，百分比） */
  scanlinePosition: number;
  /** 谱面行在视口内的垂直位置（0-100，百分比） */
  snapPosition: number;
  /** 是否显示扫描线 */
  showScanline: boolean;
  /** 是否开启渐显（播放时右侧未播区域调暗） */
  reveal: boolean;
  /** 音符飞入开关（播放时生效） */
  showFlyIn: boolean;
  /** 飞入：横向飞入距离（0-100，100 ≈ 800 世界 px） */
  flyInDistance: number;
  /** 飞入：纵向散落范围（0-100，100 ≈ ±200 世界 px） */
  flyInScatter: number;
  /** 飞入：起步延迟（0-100，100 ≈ 600 世界 px） */
  flyInDelay: number;
  /**
   * 飞入带宽度（0-100，100 ≈ 300 世界 px）：图元越过揭示边缘
   * （视口右缘内缩 50px）后在此宽度内完成飞入（ADR 0012）
   */
  flyInDuration: number;
  /** 符头高光开关（播放时生效） */
  showGlow: boolean;
  /** 高光：作用范围（0-100，100 ≈ 播放头两侧 400 世界 px） */
  glowRange: number;
  /** 高光：强度（0-100，映射光斑峰值不透明度） */
  glowIntensity: number;
  /** 高光：大小（0-100，100 ≈ 光斑半径 80 世界 px） */
  glowSize: number;
  /** 高光颜色（#rrggbb hex） */
  glowColor: string;
  /** 按 x 升序排序的音符信息（符头高光定位用） */
  notes: ScoreNoteInfo[];
  /** 背景样式 */
  background: ScoreBackgroundStyle;
  /** 全局深色主题（影响 canvas 内扫描线/渐显取色） */
  dark: boolean;
  /** 图元缓存（由 useOsmd 一次性解析填充，加载完成后完整可用） */
  primitives: PrimitiveIndex;
  /** 解析进度版本号（新片解析完成后自增，触发重绘） */
  primitivesVersion: number;
  loading: boolean;
  /**
   * 播放状态（仅用于交互判定：播放中禁止手动拖拽平移）。
   * 揭示编排的激活不以播放状态为条件——已加载乐谱即激活（ADR 0012）
   */
  playbackState: ScorePlaybackState;
}>();

const emit = defineEmits<{
  "update:zoom": [value: number];
}>();

const { t } = useI18n();

const scrollEl = ref<HTMLElement>();
const canvasEl = ref<HTMLCanvasElement>();
const osmdEl = ref<HTMLElement>();

// ============ 缩放（实用边界，体感无限） ============

const ZOOM_MIN = 0.01;
const ZOOM_MAX = 50;
/** 按钮缩放的倍率步进（乘法步进在宽范围内手感均匀） */
const ZOOM_STEP_FACTOR = 1;
/** 滚轮单次缩放的最大跨度 */
const WHEEL_STEP_MAX = 0.1;

function clampZoom(v: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));
}

/** 乘法步进缩放并夹紧到边界 */
function zoomBy(current: number, factor: number): number {
  return clampZoom(current * factor);
}

/** 缩放百分比显示：常规范围显示整数，极值范围自适应小数位 */
const zoomLabel = computed(() => {
  const pct = props.zoom * 100;
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${pct.toFixed(pct >= 1 ? 1 : 2)}%`;
});

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ============ 内容偏移与视口测量 ============

/** 首拍留白（未缩放内容 px，让首音符也能对齐到扫描线） */
let contentOffsetX = 0;
/** 谱面行垂直初始偏移（未缩放内容 px） */
let contentOffsetY = 0;
/** 视口尺寸缓存（播放期每帧读取，绝不读 clientWidth） */
let viewportW = 0;
let viewportH = 0;
/** 谱面完整布局高度（未缩放 px，由 OSMD 布局模型提取） */
let explicitContentHeight = 0;
/** 画布背板尺寸缓存（避免每帧赋值 canvas.width 清空画布） */
let backingW = 0;
let backingH = 0;

const backgroundClass = computed(
  (): string =>
    ({
      theme: "bg-base-300",
      paper: "bg-[#f5f1e8]",
      black: "bg-black",
      gradient: "bg-gradient-to-b from-base-300 to-base-200",
    })[props.background],
);

/**
 * 刷新视口测量与内容偏移，并同步画布背板尺寸。
 * @param _explicitWidth - 谱面完整布局宽度（未缩放 px）。保留以兼容
 *   同步器调用签名；Canvas 方案下视口不再消费内容宽度，仅使用高度。
 * @param explicitHeight - 谱面完整布局高度（未缩放 px）。
 *   Canvas 方案下 SVG 解析后即摘除，垂直定位以布局模型高度为准；
 *   省略时沿用上次值。挂载/resize/设置/缩放变更时调用，播放期不调用。
 */
function syncContentSize(_explicitWidth?: number, explicitHeight?: number): void {
  const scroller = scrollEl.value;
  const canvas = canvasEl.value;
  if (!scroller || !canvas) return;
  if (explicitHeight !== undefined && explicitHeight > 0) {
    explicitContentHeight = explicitHeight;
  }

  viewportW = scroller.clientWidth;
  viewportH = scroller.clientHeight;

  // 首拍留白与谱面行定位按视口可见内容的未缩放尺寸计算
  const visibleUnscaledW = viewportW / props.zoom;
  const visibleUnscaledH = viewportH / props.zoom;
  const scanPct = clamp(props.scanlinePosition, 0, 100);
  contentOffsetX = (visibleUnscaledW * scanPct) / 100;

  const snapPct = clamp(props.snapPosition, 0, 100);
  contentOffsetY = clamp(
    (visibleUnscaledH * snapPct) / 100 - explicitContentHeight / 2,
    0,
    Math.max(0, visibleUnscaledH - explicitContentHeight),
  );

  const size = backingStoreSize(
    viewportW,
    viewportH,
    window.devicePixelRatio || 1,
    backingW,
    backingH,
  );
  if (size) {
    backingW = size.width;
    backingH = size.height;
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.width = `${viewportW}px`;
    canvas.style.height = `${viewportH}px`;
  }
}

// ============ 重绘调度（dirty + rAF 合并，无空转循环） ============

let renderRaf = 0;
let dirty = false;

function requestRender(): void {
  dirty = true;
  if (!renderRaf) {
    renderRaf = requestAnimationFrame(renderFrame);
  }
}

function renderFrame(): void {
  renderRaf = 0;
  if (!dirty) return;
  dirty = false;
  drawNow();
}

function drawNow(): void {
  const canvas = canvasEl.value;
  const ctx = canvas?.getContext("2d") as ScoreContext2D | null;
  if (!canvas || !ctx) return;

  // 揭示编排激活条件 = 已加载乐谱（有图元即激活，ADR 0012）：
  // 初始进度曲谱仅开头可见，进度条拖到哪显示到哪，不区分播放/暂停/idle
  const activated = props.primitives.items.length > 0;
  const scanline: ScanlineDraw | null =
    activated && props.showScanline
      ? { positionPct: props.scanlinePosition, color: colorPrimary }
      : null;
  const reveal: RevealDraw | null =
    activated && props.reveal
      ? {
          positionPct: props.scanlinePosition,
          color: dimColor(),
          softEdge: REVEAL_SOFT_EDGE,
        }
      : null;

  // 播放动画参数：0-100 设置 → 世界 px（映射与 score-scroll.cn 对齐）
  // 飞入带宽度：100 ≈ 300px（渲染器内揭示边缘 = 视口右缘内缩 50px）
  const flyIn: FlyInEffect | null =
    activated && props.showFlyIn
      ? {
          bandWidth: props.flyInDuration * 3,
          distance: props.flyInDistance * 8,
          scatter: props.flyInScatter * 4,
          delay: props.flyInDelay * 6,
        }
      : null;
  const glow: GlowEffect | null =
    activated && props.showGlow
      ? {
          range: props.glowRange * 4,
          intensity: props.glowIntensity / 100,
          size: props.glowSize * 0.8,
          color: props.glowColor,
        }
      : null;

  drawScoreFrame(ctx, props.primitives, {
    view: {
      panX: panX.value,
      panY: panY.value,
      zoom: props.zoom,
      contentOffsetX,
      contentOffsetY,
    },
    cssWidth: viewportW,
    cssHeight: viewportH,
    dpr: window.devicePixelRatio || 1,
    scanline,
    reveal,
    playheadPct: activated ? props.scanlinePosition : null,
    flyIn,
    glow,
    notes: props.notes,
  });
}

// ============ 平移（渲染参数，无边界） ============

/** 当前平移量（显示 px，无边界） */
const panX = ref(0);
const panY = ref(0);

/**
 * 滚动到内容坐标 x（未缩放内容坐标），使 x 对齐视口内锚点。
 * 无边界：不钳制（播放滚动始终能对齐扫描线）。
 */
function scrollToContentX(x: number, anchorOffsetPx: number): void {
  panX.value = anchorOffsetPx - (contentOffsetX + x) * props.zoom;
  requestRender();
}

/** 视口宽度（px）—— 返回缓存值，绝不读取 clientWidth */
function getViewportWidth(): number {
  return viewportW;
}

/** 重置滚动到起始（首拍对齐扫描线，垂直位置回到初始定位） */
function scrollToStart(): void {
  const anchor = (viewportW * props.scanlinePosition) / 100;
  panX.value = anchor - contentOffsetX * props.zoom;
  panY.value = -contentOffsetY * props.zoom;
  requestRender();
}

/** 滚轮 → 缩放（以鼠标位置为中心），同步调整平移保持锚点不动 */
function onWheel(e: WheelEvent): void {
  e.preventDefault();
  cancelAnimationFrame(momentumRaf);
  cancelAnimationFrame(moveRaf);
  moveRaf = 0;

  const scroller = scrollEl.value;
  if (!scroller) return;

  const oldZoom = props.zoom;
  // 滚轮步进：低倍率线性（0.1），高倍率乘法（保持手感均匀）
  const linear = e.deltaY > 0 ? -0.1 : 0.1;
  const multiplicative = oldZoom * (e.deltaY > 0 ? 1 / 1.1 : 1.1) - oldZoom;
  const step = clamp(
    oldZoom > 3 ? multiplicative : linear,
    -WHEEL_STEP_MAX,
    WHEEL_STEP_MAX,
  );
  const next = clampZoom(oldZoom + step);
  if (next === oldZoom) return;

  const rect = scroller.getBoundingClientRect();
  const anchorPx = e.clientX - rect.left;
  const anchorPy = e.clientY - rect.top;

  // 鼠标指向的内容坐标（未缩放单位）
  const contentX = (anchorPx - panX.value) / oldZoom - contentOffsetX;
  const contentY = (anchorPy - panY.value) / oldZoom - contentOffsetY;

  emit("update:zoom", next);

  // 调整平移，使该内容点缩放后仍位于鼠标处（无边界钳制）
  panX.value = anchorPx - (contentOffsetX + contentX) * next;
  panY.value = anchorPy - (contentOffsetY + contentY) * next;
  requestRender();
}

// ============ overlay 取色（CSS 变量 → canvas 可用颜色串） ============

/** 软边过渡宽度（css px） */
const REVEAL_SOFT_EDGE = 160;

let colorPrimary = "#3b82f6";
let dimColorResolved: string | null = null;

/** 各背景主题对应的调光基色（CSS 变量名或字面色值） */
const DIM_COLORS: Record<ScoreBackgroundStyle, string> = {
  theme: "var(--color-base-300)",
  paper: "#f5f1e8",
  black: "#000000",
  gradient: "var(--color-base-200)",
};

/** 解析 CSS 变量为 computed 颜色串（canvas 颜色解析器接受原串） */
function resolveCssColor(varName: string): string {
  const scroller = scrollEl.value;
  if (!scroller) return "";
  const raw = getComputedStyle(scroller).getPropertyValue(varName).trim();
  return raw || "";
}

function refreshOverlayColors(): void {
  colorPrimary = resolveCssColor("--color-primary") || colorPrimary;
  dimColorResolved = null;
}

function dimColor(): string {
  if (dimColorResolved == null) {
    const spec = DIM_COLORS[props.background];
    dimColorResolved = spec.startsWith("var(")
      ? resolveCssColor(spec.slice(4, -1))
      : spec;
  }
  return dimColorResolved;
}

// ============ 鼠标拖拽（内容跟随光标 + rAF 节流 + 惯性，无边界） ============

const isDragging = ref(false);

const dragCursorClass = computed(() =>
  isDragging.value ? "cursor-grabbing" : "cursor-grab",
);

let dragPointerId: number | null = null;
let dragButton = 0;
let dragStartX = 0;
let dragStartY = 0;
let dragStartPanX = 0;
let dragStartPanY = 0;
let dragMoved = false;

let pendingDx = 0;
let pendingDy = 0;
let moveRaf = 0;
let lastSampleTime = 0;
let lastAppliedDx = 0;
let lastAppliedDy = 0;
let velocityX = 0;
let velocityY = 0;
let momentumRaf = 0;

/** rAF 节流核心：内容跟随光标（无边界钳制） */
function applyPendingMove(): void {
  moveRaf = 0;
  if (!isDragging.value) return;

  panX.value = dragStartPanX + pendingDx;
  panY.value = dragStartPanY + pendingDy;
  requestRender();

  const now = performance.now();
  const dt = Math.max(1, now - lastSampleTime);
  velocityX = velocityX * 0.7 + ((pendingDx - lastAppliedDx) / dt) * 0.3;
  velocityY = velocityY * 0.7 + ((pendingDy - lastAppliedDy) / dt) * 0.3;
  lastAppliedDx = pendingDx;
  lastAppliedDy = pendingDy;
  lastSampleTime = now;
}

/** 惯性滑行：自然衰减至停止（无边界，不会撞墙停下） */
function applyMomentum(): void {
  if (Math.abs(velocityX) < 0.05 && Math.abs(velocityY) < 0.05) return;

  const decay = 0.95;
  const step = (): void => {
    velocityX *= decay;
    velocityY *= decay;
    panX.value += velocityX * 16;
    panY.value += velocityY * 16;
    requestRender();

    if (Math.abs(velocityX) > 0.02 || Math.abs(velocityY) > 0.02) {
      momentumRaf = requestAnimationFrame(step);
    }
  };
  momentumRaf = requestAnimationFrame(step);
}

/** 拖拽后短暂拦截 click（防止拖拽结束误触页面元素） */
function suppressClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  window.removeEventListener("click", suppressClick, true);
}

function onPointerDown(e: PointerEvent): void {
  if (e.pointerType !== "mouse") return;
  if (e.button !== 0 && e.button !== 2) return;
  if (props.playbackState === "playing") return; // 播放中由代码驱动平移
  const scroller = scrollEl.value;
  if (!scroller) return;

  cancelAnimationFrame(momentumRaf);
  cancelAnimationFrame(moveRaf);
  moveRaf = 0;
  dragPointerId = e.pointerId;
  dragButton = e.button;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartPanX = panX.value;
  dragStartPanY = panY.value;
  dragMoved = false;
  pendingDx = 0;
  pendingDy = 0;
  lastAppliedDx = 0;
  lastAppliedDy = 0;
  lastSampleTime = performance.now();
  velocityX = 0;
  velocityY = 0;
  isDragging.value = true;
  scroller.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
  if (dragPointerId !== e.pointerId || !isDragging.value) return;

  pendingDx = e.clientX - dragStartX;
  pendingDy = e.clientY - dragStartY;
  if (!dragMoved && (Math.abs(pendingDx) > 3 || Math.abs(pendingDy) > 3)) {
    dragMoved = true;
  }
  if (!dragMoved) return;

  if (!moveRaf) {
    moveRaf = requestAnimationFrame(applyPendingMove);
  }
}

function onPointerUp(e: PointerEvent): void {
  if (dragPointerId !== e.pointerId) return;
  const scroller = scrollEl.value;
  dragPointerId = null;
  scroller?.releasePointerCapture(e.pointerId);

  if (moveRaf) {
    cancelAnimationFrame(moveRaf);
    moveRaf = 0;
    applyPendingMove();
  }
  isDragging.value = false;

  if (dragMoved && e.button === 0) {
    window.addEventListener("click", suppressClick, { capture: true, once: true });
  }

  applyMomentum();
}

function onPointerCancel(e: PointerEvent): void {
  if (dragPointerId !== e.pointerId) return;
  const scroller = scrollEl.value;
  dragPointerId = null;
  isDragging.value = false;
  if (moveRaf) {
    cancelAnimationFrame(moveRaf);
    moveRaf = 0;
  }
  scroller?.releasePointerCapture(e.pointerId);
  velocityX = 0;
  velocityY = 0;
}

/** 右键菜单拦截：仅拖拽过的右键阻止菜单 */
function onContextMenu(e: MouseEvent): void {
  if (isDragging.value && dragButton === 2) {
    e.preventDefault();
    return;
  }
  if (dragMoved) {
    e.preventDefault();
    dragMoved = false;
  }
}

// ============ 观察者与生命周期 ============

let resizeObserver: ResizeObserver | undefined;
function attachObserver(): void {
  const scroller = scrollEl.value;
  if (!scroller || resizeObserver) return;
  resizeObserver = new ResizeObserver(() => {
    syncContentSize();
    refreshOverlayColors();
    requestRender();
  });
  resizeObserver.observe(scroller);
}

watch(
  [scrollEl, () => props.scanlinePosition, () => props.snapPosition],
  () => {
    syncContentSize();
    refreshOverlayColors();
    attachObserver();
    requestRender();
  },
  { flush: "post" },
);

// 缩放变化：内容偏移按未缩放尺寸重算 + 重绘
watch(
  () => props.zoom,
  () => {
    syncContentSize();
    requestRender();
  },
);

// 渲染参数变化：背景/主题（取色）、扫描线/渐显开关、播放状态、
// 飞入/高光参数与开关、音符表（高光定位数据）
watch(
  [
    () => props.background,
    () => props.dark,
    () => props.showScanline,
    () => props.reveal,
    () => props.playbackState,
    () => props.showFlyIn,
    () => props.flyInDistance,
    () => props.flyInScatter,
    () => props.flyInDelay,
    () => props.flyInDuration,
    () => props.showGlow,
    () => props.glowRange,
    () => props.glowIntensity,
    () => props.glowSize,
    () => props.glowColor,
    () => props.notes,
  ],
  () => {
    refreshOverlayColors();
    requestRender();
  },
);

// 图元解析进度：新片解析完成后重绘出新内容
watch(
  () => props.primitivesVersion,
  () => requestRender(),
);

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = undefined;
  cancelAnimationFrame(momentumRaf);
  cancelAnimationFrame(moveRaf);
  cancelAnimationFrame(renderRaf);
  window.removeEventListener("click", suppressClick, true);
});

defineExpose({
  scrollEl,
  osmdEl,
  scrollToContentX,
  getViewportWidth,
  scrollToStart,
  syncContentSize,
});
</script>

<style scoped>
/*
 * OSMD 数据源容器：固定定位移出屏幕且保持非 display:none——
 * getBBox/measureText 需要元素参与布局才能度量；
 * 渲染产出的 SVG 节点解析后即被摘除，常态为空。
 */
.score-osmd-source {
  position: fixed;
  left: -100000px;
  top: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.score-osmd-source :deep(svg) {
  position: absolute;
  left: -100000px;
  top: 0;
}
</style>
