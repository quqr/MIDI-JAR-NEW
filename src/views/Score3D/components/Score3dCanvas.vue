<template>
  <!-- z-0 创建 stacking context，把 three.js canvas 限制在容器内部，
       避免突破到外层覆盖顶部 UI 与播放控制面板 -->
  <div ref="containerRef" class="absolute inset-0 overflow-hidden z-0">
    <!-- three.js WebGLRenderer 的 canvas：必须显式 w-full h-full，
         防止 canvas.width 属性反噬 CSS 尺寸 -->
    <canvas ref="canvasRef" class="block w-full h-full" />
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

let engine: Score3dEngine | null = null;
let resizeObserver: ResizeObserver | null = null;

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

defineExpose({
  getEngine: () => engine,
});
</script>
