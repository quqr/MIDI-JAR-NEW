<template>
  <!-- z-0 创建 stacking context，把 three.js canvas 限制在容器内部，
       避免突破到外层覆盖顶部 UI 与播放控制面板 -->
  <div ref="containerRef" class="absolute inset-0 overflow-hidden z-0">
    <!-- three.js WebGLRenderer 的 canvas：必须显式 w-full h-full，
         防止 canvas.width 属性反噬 CSS 尺寸；touch-none 保证触屏拖拽不滚动页面 -->
    <canvas
      ref="canvasRef"
      class="block w-full h-full touch-none cursor-grab active:cursor-grabbing"
      :aria-label="$t('score3d.viewport')"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel.prevent="onWheel"
      @dblclick="onDoubleClick"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { Score3dEngine } from "../engine/Score3dEngine";

const emit = defineEmits<{
  (e: "ready", engine: Score3dEngine): void;
}>();

const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();

/** 拖拽旋转灵敏度（像素 → 弧度） */
const DRAG_SENSITIVITY = 0.005;
/** 滚轮单步缩放倍率 */
const ZOOM_STEP = 1.1;

let engine: Score3dEngine | null = null;
let resizeObserver: ResizeObserver | null = null;
let dragging = false;
let lastX = 0;
let lastY = 0;

onMounted(() => {
  if (!canvasRef.value || !containerRef.value) return;

  engine = new Score3dEngine(canvasRef.value);
  const container = containerRef.value;
  const doResize = () => {
    if (!engine || !container) return;
    const rect = container.getBoundingClientRect();
    engine.resize(Math.max(1, rect.width), Math.max(1, rect.height));
  };
  doResize();
  resizeObserver = new ResizeObserver(doResize);
  resizeObserver.observe(container);
  engine.start();

  emit("ready", engine);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  engine?.dispose();
  engine = null;
});

function onPointerDown(event: PointerEvent): void {
  if (!engine) return;
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging || !engine) return;
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  engine.adjustOrbit(dx * DRAG_SENSITIVITY, dy * DRAG_SENSITIVITY);
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging) return;
  dragging = false;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
}

function onWheel(event: WheelEvent): void {
  if (!engine) return;
  // 滚轮向上（deltaY < 0）拉近，向下拉远
  engine.adjustZoom(event.deltaY < 0 ? 1 / ZOOM_STEP : ZOOM_STEP);
}

function onDoubleClick(): void {
  engine?.resetView();
}

defineExpose({
  getEngine: () => engine,
});
</script>
