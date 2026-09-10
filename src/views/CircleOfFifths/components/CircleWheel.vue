<script setup lang="ts">
/**
 * 五度循环圈 — 三环 SVG 本体。
 *
 * 环层（外→内）：大调主音 / 关系小调 / 调号记号。
 * 一个「位置」= 一个扇区 = 一整个径向切片；三环同属它，命中区与语义都按切片走。
 *
 * 交互：悬停只出 tooltip 预览（不动选中态），点击锁定选中。
 * 键盘：←/→ 换位置、↑/↓ 换调式、M 切换大小调、Enter/Space 提交
 * （listbox + aria-activedescendant 模式，容器持有焦点）。
 *
 * 变换统一走 CSS `scale` 并配 `transform-origin` 指向圆心 —— 入场、悬停、
 * 脉冲三种缩放因此都沿半径方向推出。切勿同时用 transform 属性，两者会互相覆盖。
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { animate, stagger } from "animejs";
import {
  POSITION_COUNT,
  SECTOR_ANGLE,
  keyDisplayName,
  positionToAngle,
  signatureText,
  type CircleKey,
  type KeyMode,
  type KeyRelation,
  type KeySelection,
  type RelationKind,
} from "../circleOfFifths";
import {
  countUp,
  createMotionScope,
  drawStroke,
  motionEnabled,
  type Revertible,
} from "./anim";

const props = defineProps<{
  /** 12 格环数据（buildCircleData 结果） */
  circle: CircleKey[];
  /** 当前锁定的选中调 */
  selected: KeySelection;
  /** 全项目当前调号（徽章标记） */
  currentKey: KeySelection;
  /** 选中调的近关系调 */
  relations: KeyRelation[];
  /** 正在试听的调性，用于扇区呼吸 */
  playingKey: { tonic: string; mode: KeyMode } | null;
  /** 是否处于「选目标调」状态（移调进行中） */
  pickingTarget: boolean;
}>();

const emit = defineEmits<{
  (e: "select", selection: KeySelection): void;
}>();

const { t } = useI18n();

/* ── 几何 ─────────────────────────────────────────────── */

const SIZE = 400;
const CENTER = SIZE / 2;
/** 环层半径（外 → 内） */
const RING_MAJOR = { rOuter: 186, rInner: 146 };
const RING_MINOR = { rOuter: 146, rInner: 112 };
const RING_SIGNATURE = { rOuter: 112, rInner: 84 };
/** 扇区间缝隙（度，两侧各留一半） */
const GAP_DEG = 1.2;
/** 当前调号徽章所在半径 */
const BADGE_RADIUS = 194;

const MAJOR_BAND_R = (RING_MAJOR.rOuter + RING_MAJOR.rInner) / 2;
const MINOR_BAND_R = (RING_MINOR.rOuter + RING_MINOR.rInner) / 2;
const SIGNATURE_BAND_R = (RING_SIGNATURE.rOuter + RING_SIGNATURE.rInner) / 2;

/** 极坐标 → 笛卡尔坐标（0° 为 3 点方向，顺时针为正） */
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

/** 圆环扇区（annulus sector）路径 */
function annulusPath(
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  const o1 = polar(startDeg, rOuter);
  const o2 = polar(endDeg, rOuter);
  const i2 = polar(endDeg, rInner);
  const i1 = polar(startDeg, rInner);

  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

type Sector = {
  position: number;
  key: CircleKey;
  mid: number;
  majorPath: string;
  minorPath: string;
  signaturePath: string;
  majorText: { x: number; y: number };
  minorText: { x: number; y: number };
  signatureText: { x: number; y: number };
  /** 内环靠近圆心的锚点（tooltip 定位用） */
  innerAnchor: { x: number; y: number };
};

const sectors = computed<Sector[]>(() =>
  props.circle.map((key) => {
    const mid = positionToAngle(key.position);
    const start = mid - SECTOR_ANGLE / 2 + GAP_DEG / 2;
    const end = mid + SECTOR_ANGLE / 2 - GAP_DEG / 2;
    return {
      position: key.position,
      key,
      mid,
      majorPath: annulusPath(RING_MAJOR.rOuter, RING_MAJOR.rInner, start, end),
      minorPath: annulusPath(RING_MINOR.rOuter, RING_MINOR.rInner, start, end),
      signaturePath: annulusPath(
        RING_SIGNATURE.rOuter,
        RING_SIGNATURE.rInner,
        start,
        end,
      ),
      majorText: polar(mid, MAJOR_BAND_R),
      minorText: polar(mid, MINOR_BAND_R),
      signatureText: polar(mid, SIGNATURE_BAND_R),
      innerAnchor: polar(mid, RING_SIGNATURE.rOuter),
    };
  }),
);

/* ── 引用与状态 ───────────────────────────────────────── */

const sectorEls = ref<SVGGElement[]>([]);
const lineEls = ref<SVGLineElement[]>([]);
const badgeEl = ref<SVGCircleElement>();
const signatureEl = ref<SVGTextElement>();

const hoveredPosition = ref<number | null>(null);
const focusedPosition = ref(props.selected.position);
const hasKeyboardFocus = ref(false);
const scope = createMotionScope();

function registerSector(el: Element | null, position: number): void {
  if (el) sectorEls.value[position] = el as SVGGElement;
}

function registerLine(el: Element | null, index: number): void {
  if (el) lineEls.value[index] = el as SVGLineElement;
}

/* ── 扇区角色与配色 ───────────────────────────────────── */

type SectorRole = {
  selected: boolean;
  relation: RelationKind | null;
  current: boolean;
};

function roleOf(position: number): SectorRole {
  return {
    selected: position === props.selected.position,
    relation:
      props.relations.find((relation) => relation.position === position)
        ?.kind ?? null,
    current: position === props.currentKey.position,
  };
}

/** 近关系 → 主题色 token（冷暖区分远近：属/下属为冷色，关系/同名为暖色） */
const RELATION_TOKEN: Record<RelationKind, string> = {
  dominant: "--color-success",
  subdominant: "--color-info",
  relative: "--color-accent",
  parallel: "--color-warning",
};

function sectorFill(position: number): string {
  const role = roleOf(position);
  if (role.selected) return "var(--color-primary)";
  if (role.relation) {
    return `color-mix(in oklab, var(${RELATION_TOKEN[role.relation]}) 26%, var(--color-base-200))`;
  }
  if (role.current) {
    return "color-mix(in oklab, var(--color-secondary) 20%, var(--color-base-200))";
  }
  return "var(--color-base-200)";
}

function sectorStroke(position: number): string {
  const role = roleOf(position);
  if (role.selected) return "var(--color-primary)";
  if (role.relation) return `var(${RELATION_TOKEN[role.relation]})`;
  if (role.current) return "var(--color-secondary)";
  return "transparent";
}

function sectorTextFill(position: number): string {
  return roleOf(position).selected
    ? "var(--color-primary-content)"
    : "var(--color-base-content)";
}

/** 悬停或键盘焦点所在的位置 */
function isActive(position: number): boolean {
  return (
    hoveredPosition.value === position ||
    (hasKeyboardFocus.value && focusedPosition.value === position)
  );
}

/* ── 近关系连线 ───────────────────────────────────────── */

type RelationLine = {
  key: string;
  kind: RelationKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
};

function anchorOf(position: number, mode: KeyMode): { x: number; y: number } {
  return polar(
    positionToAngle(position),
    mode === "major" ? MAJOR_BAND_R : MINOR_BAND_R,
  );
}

const relationLines = computed<RelationLine[]>(() => {
  const from = anchorOf(props.selected.position, props.selected.mode);
  return props.relations.map((relation) => {
    const to = anchorOf(relation.position, relation.mode);
    return {
      key: `${relation.kind}-${relation.position}`,
      kind: relation.kind,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      color: `var(${RELATION_TOKEN[relation.kind]})`,
    };
  });
});

/* ── 圆心读数 ─────────────────────────────────────────── */

const selectedKey = computed(
  () => props.circle[props.selected.position] ?? props.circle[0],
);

const centerLabel = computed(() =>
  keyDisplayName(
    props.selected.mode === "major"
      ? selectedKey.value.majorTonic
      : selectedKey.value.minorTonic,
    props.selected.mode,
  ),
);

const centerSignature = computed(() => signatureText(selectedKey.value));

/* ── 悬停预览 ─────────────────────────────────────────── */

const hoveredSector = computed(() =>
  hoveredPosition.value === null
    ? null
    : (sectors.value[hoveredPosition.value] ?? null),
);

/** 贴向内环并夹在可视范围内，避免浮层溢出 */
const tooltipStyle = computed(() => {
  const sector = hoveredSector.value;
  if (!sector) return undefined;
  return {
    left: `${clampPercent((sector.innerAnchor.x / SIZE) * 100, 14, 86)}%`,
    top: `${clampPercent((sector.innerAnchor.y / SIZE) * 100, 12, 88)}%`,
  };
});

function clampPercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ── 交互 ─────────────────────────────────────────────── */

let hoverAnimation: Revertible | null = null;

/** 切换悬停位置：把上一个复位，再抬起新的 */
function setHovered(position: number | null): void {
  const previous = hoveredPosition.value;
  if (previous === position) return;
  hoveredPosition.value = position;

  if (!motionEnabled()) return;

  hoverAnimation?.revert();
  hoverAnimation = null;

  const target = position === null ? previous : position;
  const group = target === null ? undefined : sectorEls.value[target];
  if (!group) return;

  hoverAnimation = animate(group, {
    scale: position === null ? 1 : 1.045,
    duration: 200,
    ease: "outQuad",
  });
}

function selectPosition(position: number): void {
  emit("select", { position, mode: props.selected.mode });
}

/* ── 键盘 ─────────────────────────────────────────────── */

const activeDescendantId = computed(
  () => `fifths-option-${focusedPosition.value}`,
);

function onKeydown(event: KeyboardEvent): void {
  const position = focusedPosition.value;
  let next = position;
  let handled = true;

  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
      next = (position + 1) % POSITION_COUNT;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      next = (position - 1 + POSITION_COUNT) % POSITION_COUNT;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = POSITION_COUNT - 1;
      break;
    case "Enter":
    case " ":
      emit("select", { position, mode: props.selected.mode });
      return;
    default:
      handled = false;
  }

  if (!handled) return;
  event.preventDefault();
  focusedPosition.value = next;
  setHovered(next);
}

/* ── 动画 ─────────────────────────────────────────────── */

let playingAnimation: Revertible | null = null;

onMounted(() => {
  const groups = sectorEls.value.filter(Boolean);
  const lines = lineEls.value.filter(Boolean);
  if (!motionEnabled()) return;

  // 环带自圆心展开，12 个扇区错峰浮现
  scope.track(
    animate(groups, {
      scale: [0.86, 1],
      opacity: [0, 1],
      duration: 620,
      delay: stagger(26),
      ease: "outExpo",
    }),
  );
  scope.track(
    animate(lines, {
      opacity: [0, 1],
      duration: 420,
      delay: stagger(60, { start: 360 }),
      ease: "outQuad",
    }),
  );
});

onUnmounted(() => {
  hoverAnimation?.revert();
  playingAnimation?.revert();
  scope.dispose();
});

/** 选中变化：新选中扇区脉冲 */
watch(
  () => props.selected.position,
  (position) => {
    focusedPosition.value = position;
    if (!motionEnabled()) return;
    const group = sectorEls.value[position];
    if (!group) return;
    scope.track(
      animate(group, {
        scale: [1, 1.06, 1],
        duration: 360,
        ease: "inOutQuad",
      }),
    );
  },
);

/** 近关系变化：连线逐条描画（flush post —— 等 DOM 更新后再测量长度） */
watch(
  () => props.relations,
  () => {
    if (!motionEnabled()) return;
    for (const line of lineEls.value.filter(Boolean)) {
      scope.track(drawStroke(line, { duration: 520 }));
    }
  },
  { deep: true, flush: "post" },
);

/** 当前调号变化：徽章沿环滑到新位置 */
watch(
  () => props.currentKey.position,
  (position, previous) => {
    const circle = badgeEl.value;
    if (!circle) return;

    const to = polar(positionToAngle(position), BADGE_RADIUS);

    if (!motionEnabled() || previous === undefined) {
      circle.setAttribute("cx", String(to.x));
      circle.setAttribute("cy", String(to.y));
      return;
    }

    const from = polar(positionToAngle(previous), BADGE_RADIUS);
    const carrier = { progress: 0 };
    scope.track(
      animate(carrier, {
        progress: 1,
        duration: 480,
        ease: "outExpo",
        onUpdate: () => {
          circle.setAttribute(
            "cx",
            String(from.x + (to.x - from.x) * carrier.progress),
          );
          circle.setAttribute(
            "cy",
            String(from.y + (to.y - from.y) * carrier.progress),
          );
        },
      }),
    );
  },
  { immediate: true },
);

/** 试听：选中扇区呼吸（先回退上一轮，避免动画堆积） */
watch(
  () => props.playingKey,
  (playing) => {
    playingAnimation?.revert();
    playingAnimation = null;
    if (!playing || !motionEnabled()) return;

    const group = sectorEls.value[props.selected.position];
    if (!group) return;
    playingAnimation = animate(group, {
      opacity: [1, 0.7, 1],
      duration: 1200,
      loop: true,
      ease: "inOutSine",
    });
  },
);

/** 圆心升降号数字滚动 */
watch(
  centerSignature,
  (value) => {
    const element = signatureEl.value;
    if (!element) return;
    const numeric = Number.parseInt(value, 10);
    if (Number.isNaN(numeric)) {
      element.textContent = value;
      return;
    }
    scope.track(countUp(element, numeric));
  },
  { immediate: true },
);
</script>

<template>
  <div class="relative w-full max-w-[600px] mx-auto">
    <svg
      :viewBox="`0 0 ${SIZE} ${SIZE}`"
      class="fifths-wheel w-full h-auto select-none outline-none"
      role="listbox"
      tabindex="0"
      :aria-label="t('circleOfFifths.wheel.ariaLabel')"
      :aria-activedescendant="activeDescendantId"
      :class="pickingTarget ? 'cursor-crosshair' : 'cursor-pointer'"
      @keydown="onKeydown"
      @focus="hasKeyboardFocus = true"
      @blur="hasKeyboardFocus = false"
      @mouseleave="setHovered(null)"
    >
      <!-- 近关系连线（置于扇区之下） -->
      <g class="pointer-events-none">
        <line
          v-for="(line, index) in relationLines"
          :key="line.key"
          :ref="(el) => registerLine(el as Element | null, index)"
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
          :stroke="line.color"
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="6 5"
        />
      </g>

      <!-- 12 个位置（每个位置 = 一整个径向切片） -->
      <g
        v-for="sector in sectors"
        :id="`fifths-option-${sector.position}`"
        :key="sector.position"
        :ref="(el) => registerSector(el as Element | null, sector.position)"
        class="fifths-sector"
        role="option"
        :aria-selected="roleOf(sector.position).selected"
        :aria-label="
          t('circleOfFifths.wheel.sectorAria', {
            major: sector.key.majorTonic,
            minor: keyDisplayName(sector.key.minorTonic, 'minor'),
            signature: signatureText(sector.key),
          })
        "
        @click="selectPosition(sector.position)"
        @mouseenter="setHovered(sector.position)"
      >
        <!-- 外环：大调主音 -->
        <path
          :d="sector.majorPath"
          :fill="
            isActive(sector.position) && !roleOf(sector.position).selected
              ? 'var(--color-base-300)'
              : sectorFill(sector.position)
          "
          :stroke="sectorStroke(sector.position)"
          stroke-width="1.5"
        />
        <text
          :x="sector.majorText.x"
          :y="sector.majorText.y"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="17"
          font-weight="600"
          :fill="sectorTextFill(sector.position)"
        >
          {{ sector.key.majorTonic }}
        </text>

        <!-- 中环：关系小调 -->
        <path
          :d="sector.minorPath"
          :fill="sectorFill(sector.position)"
          :stroke="sectorStroke(sector.position)"
          stroke-width="1.5"
        />
        <text
          :x="sector.minorText.x"
          :y="sector.minorText.y"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="14"
          :fill="sectorTextFill(sector.position)"
        >
          {{ keyDisplayName(sector.key.minorTonic, "minor") }}
        </text>

        <!-- 内环：调号记号 -->
        <path
          :d="sector.signaturePath"
          :fill="sectorFill(sector.position)"
          :stroke="sectorStroke(sector.position)"
          stroke-width="1.5"
        />
        <text
          :x="sector.signatureText.x"
          :y="sector.signatureText.y"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="12"
          :fill="sectorTextFill(sector.position)"
          opacity="0.78"
        >
          {{ signatureText(sector.key) }}
        </text>

        <!-- 键盘焦点环 -->
        <path
          v-if="hasKeyboardFocus && focusedPosition === sector.position"
          :d="sector.majorPath"
          fill="none"
          stroke="var(--color-base-content)"
          stroke-width="2"
          stroke-dasharray="4 3"
        />
      </g>

      <!-- 圆心读数 -->
      <g class="pointer-events-none">
        <circle
          :cx="CENTER"
          :cy="CENTER"
          :r="RING_SIGNATURE.rInner - 6"
          fill="var(--color-base-100)"
          stroke="var(--color-base-300)"
          stroke-width="1"
        />
        <text
          :x="CENTER"
          :y="CENTER - 10"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="30"
          font-weight="700"
          fill="var(--color-base-content)"
        >
          {{ centerLabel }}
        </text>
        <text
          ref="signatureEl"
          :x="CENTER"
          :y="CENTER + 24"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="15"
          fill="var(--color-base-content)"
          opacity="0.6"
        >
          {{ centerSignature }}
        </text>
      </g>

      <!-- 当前调号徽章 -->
      <circle
        ref="badgeEl"
        r="5.5"
        fill="var(--color-secondary)"
        stroke="var(--color-base-100)"
        stroke-width="2"
        class="pointer-events-none"
      />
    </svg>

    <!-- 悬停预览：非 Teleport 的本地浮层，按项目 z 语义取 dropdown -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="hoveredSector"
        class="absolute z-dropdown -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        :style="tooltipStyle"
      >
        <div
          class="card bg-base-100 border border-base-300 shadow-lg px-3 py-2 text-center whitespace-nowrap"
        >
          <div class="text-sm font-bold leading-tight">
            {{ hoveredSector.key.majorTonic }}
            <span class="text-base-content/40 mx-0.5">/</span>
            {{ keyDisplayName(hoveredSector.key.minorTonic, "minor") }}
          </div>
          <div class="text-xs text-base-content/60 mt-0.5">
            {{ signatureText(hoveredSector.key) }}
          </div>
        </div>
      </div>
    </Transition>

    <!-- 移调选目标调提示 -->
    <div
      v-if="pickingTarget"
      class="absolute inset-x-0 top-0 flex justify-center pointer-events-none"
    >
      <span class="badge badge-warning badge-sm">
        {{ t("circleOfFifths.transpose.pickHint") }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/*
 * 全部缩放动画都绕圆心进行：transform-box 取 view-box 后，
 * transform-origin 的 200px 200px 就是 viewBox 中心。
 * 入场、悬停、脉冲三种缩放因此统一为「沿半径推出」。
 */
.fifths-wheel {
  --fifths-center: 200px;
}

.fifths-sector {
  transform-box: view-box;
  transform-origin: var(--fifths-center) var(--fifths-center);
}

.fifths-wheel:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
  border-radius: var(--radius-box);
}
</style>
