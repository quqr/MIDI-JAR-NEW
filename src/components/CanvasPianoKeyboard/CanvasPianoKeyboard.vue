<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, watchEffect } from "vue";
import { Application, Container } from "pixi.js";
import { KeyboardRenderer } from "@/views/WaterfallPiano/engine/KeyboardRenderer";
import type { KeyboardSettings } from "@/types/settings";
import { getCanvasDpr, chordNotesToMidi, toKeyboardConfig } from "./utils";

// ── Props ──

interface ChordLike {
  notes?: string[];
}

interface Props {
  id?: string;
  className?: string;
  keyboard?: KeyboardSettings;
  played?: number[];
  sustained?: number[];
  midi?: number[];
  targets?: number[] | null;
  /** 和弦对象（仅用 .notes），可接收 @tonaljs/chord#Chord */
  chord?: ChordLike;
  clickable?: boolean;
  /** true: 按下保持并 emit noteOn/noteOff；false: 点击即 emit noteClick */
  sustainMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  id: undefined,
  className: undefined,
  keyboard: () => ({
    skin: "classic",
    from: "C3",
    to: "B5",
    label: "none",
    keyName: "none",
    keyInfo: "none",
    fadeOutDuration: 0,
    textOpacity: 0.5,
    displaySustained: false,
    wrap: false,
    sizes: { radius: 1, height: 5, ratio: 0.6, bevel: true },
    colors: {
      white: "#ffffff",
      black: "#000000",
      played: "#ff0000",
      wrapped: "#800000",
      sustained: "#777777",
    },
  }),
  played: () => [],
  sustained: () => [],
  midi: () => [],
  targets: null,
  chord: undefined,
  clickable: false,
  sustainMode: false,
});

const emit = defineEmits<{
  noteClick: [midi: number];
  noteOn: [midi: number];
  noteOff: [midi: number];
}>();

// ── 模板引用 ──

const containerRef = ref<HTMLDivElement | null>(null);

// ── 内部状态 ──

let renderer: KeyboardRenderer | null = null;
let pixiApp: Application | null = null;
let pixiContainer: Container | null = null;
let resizeObserver: ResizeObserver | null = null;
let rafId: number | null = null;
let resizeRafId: number | null = null;
/** sustainMode 下当前按住的音符 */
const sustainedNotes = new Set<number>();

// ── 高亮更新（经 RAF 去抖） ──

function applyHighlights(): void {
  if (!renderer) return;
  renderer.clearAllHighlights();

  const highlight = (notes?: number[] | null) => {
    if (!notes?.length) return;
    for (const midi of notes) renderer!.highlightNote(midi);
  };

  highlight(props.played);
  highlight(props.sustained);
  highlight(props.targets);
  highlight(props.midi);
  highlight(
    chordNotesToMidi(
      props.chord?.notes ?? [],
      renderer.getVisibleRange().from,
      renderer.getVisibleRange().to,
    ),
  );
  // sustainMode 下保持按住的键也要持续高亮
  if (sustainedNotes.size > 0) {
    for (const midi of sustainedNotes) renderer.highlightNote(midi);
  }

  renderer.render();
  // 驱动 PixiJS 渲染
  pixiApp?.render();
}

function scheduleRender(): void {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    applyHighlights();
  });
}

// ── 指针事件 ──

function onPointerDown(e: PointerEvent): void {
  if (!renderer || !props.clickable) return;
  e.preventDefault();

  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const midi = renderer.xToMidi(e.clientX - rect.left);
  if (midi === null) return;

  target.setPointerCapture(e.pointerId);

  if (props.sustainMode) {
    sustainedNotes.add(midi);
    emit("noteOn", midi);
  } else {
    emit("noteClick", midi);
  }
  scheduleRender();
}

function releasePointer(e: PointerEvent): void {
  if (!renderer) return;

  // 非 sustainMode 下 pointerDownNotes 恒为空，直接跳过
  if (sustainedNotes.size > 0) {
    for (const midi of sustainedNotes) emit("noteOff", midi);
    sustainedNotes.clear();
  }

  const target = e.currentTarget as HTMLElement;
  if (target?.hasPointerCapture(e.pointerId)) {
    target.releasePointerCapture(e.pointerId);
  }
  scheduleRender();
}

// ── 生命周期 ──

onMounted(async () => {
  if (!containerRef.value) return;

  // 获取容器尺寸，确保 PixiJS 渲染缓冲区与容器对齐
  const rect = containerRef.value.getBoundingClientRect();
  const canvasW = Math.max(1, Math.ceil(rect.width));
  const canvasH = Math.max(1, Math.ceil(rect.height));

  // 创建 PixiJS Application（使用容器尺寸初始化，避免默认 800x600 导致渲染不对齐）
  pixiApp = new Application();
  await pixiApp.init({
    width: canvasW,
    height: canvasH,
    antialias: false,
    backgroundAlpha: 0,
    preference: "webgl",
    resolution: window.devicePixelRatio,
    autoDensity: true,
    autoStart: false,
  });

  // 将 PixiJS canvas 添加到容器（autoDensity 自动管理 CSS 尺寸，无需手动设置 100%）
  containerRef.value.appendChild(pixiApp.canvas);

  // 创建键盘 Container
  pixiContainer = new Container();
  pixiApp.stage.addChild(pixiContainer);

  renderer = new KeyboardRenderer();
  renderer.init(
    pixiContainer,
    pixiApp.renderer,
    toKeyboardConfig(props.keyboard),
  );

  const dpr = getCanvasDpr();
  renderer.resize(canvasW, canvasH, dpr);

  applyHighlights();

  // ResizeObserver — 经 RAF 去抖，避免高频触发浪费渲染
  resizeObserver = new ResizeObserver(() => {
    if (resizeRafId !== null) return;
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null;
      if (!containerRef.value || !renderer || !pixiApp) return;
      const r = containerRef.value.getBoundingClientRect();
      const d = getCanvasDpr();
      const newW = Math.max(1, Math.ceil(r.width));
      const newH = Math.max(1, Math.ceil(r.height));
      // 同步 PixiJS 渲染器尺寸，确保渲染缓冲区与容器对齐
      pixiApp.renderer.resize(newW, newH);
      renderer.resize(newW, newH, d);
      scheduleRender();
    });
  });
  resizeObserver.observe(containerRef.value);
});

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
  resizeObserver?.disconnect();
  resizeObserver = null;
  renderer?.dispose();
  renderer = null;
  pixiApp?.destroy(true, { children: true });
  pixiApp = null;
  pixiContainer = null;
  sustainedNotes.clear();
});

// ── 响应性 ──

// watchEffect 自动追踪 props.played/sustained/midi/targets/chord 的变化，
// 无需 deep:true，且不产生无谓的新引用比较
watchEffect(() => {
  // 显式读取所有依赖，让 watchEffect 追踪
  const _deps = [
    props.played,
    props.sustained,
    props.midi,
    props.targets,
    props.chord,
  ] as const;
  void _deps;
  scheduleRender();
});

watch(
  () => props.keyboard,
  (kb) => {
    if (!renderer) return;
    renderer.setKeyboardConfig(toKeyboardConfig(kb));
    scheduleRender();
  },
  // 父组件可能原地修改 keyboard 对象的嵌套字段而不换引用，因此需要 deep
  { deep: true },
);
</script>

<template>
  <div
    ref="containerRef"
    :id="id"
    :class="className"
    style="width: 100%; height: 100%; position: relative"
    :style="{
      touchAction: clickable ? 'none' : 'auto',
      cursor: clickable ? 'pointer' : 'default',
    }"
    @pointerdown="onPointerDown"
    @pointerup="releasePointer"
    @pointercancel="releasePointer"
    @pointerleave="releasePointer"
  />
</template>
