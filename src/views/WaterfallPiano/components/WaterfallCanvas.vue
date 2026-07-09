<template>
  <div class="waterfall-canvas-wrapper" ref="wrapperRef">
    <!-- 流体 WebGL Canvas（底层） -->
    <canvas ref="fluidCanvasRef" class="fluid-canvas" />
    <!-- Canvas 2D（上层） -->
    <canvas ref="mainCanvasRef" class="main-canvas" />
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, watch, computed } from "vue";
import { WaterfallEngine } from "../engine/WaterfallEngine";
import { FluidSimulation } from "../engine/fluid";
import { resolveConfig } from "../engine/fluid/FluidConfig";
import { useWaterfallPianoStore } from "../stores/waterfallPiano";

const wrapperRef = ref<HTMLDivElement | null>(null);
const fluidCanvasRef = ref<HTMLCanvasElement | null>(null);
const mainCanvasRef = ref<HTMLCanvasElement | null>(null);

const store = useWaterfallPianoStore();
const settings = computed(() => store.settings);

const engine = shallowRef<WaterfallEngine | null>(null);
const fluidSimulation = shallowRef<FluidSimulation | null>(null);
let resizeObserver: ResizeObserver | null = null;

// ─── 初始化 ───
onMounted(async () => {
  if (!wrapperRef.value || !fluidCanvasRef.value || !mainCanvasRef.value) return;

  // 初始化流体模拟
  if (settings.value.background?.type === "fluid") {
    try {
      fluidSimulation.value = new FluidSimulation(fluidCanvasRef.value);
      fluidSimulation.value.start();
    } catch (e) {
      console.warn("Fluid simulation init failed:", e);
    }
  }

  // 初始化引擎
  engine.value = new WaterfallEngine();
  if (fluidSimulation.value) {
    engine.value.setFluidSimulation(fluidSimulation.value);
  }
  await engine.value.init(mainCanvasRef.value, settings.value);

  // 监听尺寸变化
  resizeObserver = new ResizeObserver(() => {
    engine.value?.resize();
    fluidSimulation.value?.resize();
  });
  resizeObserver.observe(wrapperRef.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;

  fluidSimulation.value?.destroy();
  fluidSimulation.value = null;

  engine.value?.destroy();
  engine.value = null;
});

// ─── 监听设置变化 ───
watch(settings, (newSettings) => {
  engine.value?.applySettings(newSettings);

  // 将流体参数同步到 FluidSimulation
  if (fluidSimulation.value && newSettings.background?.type === "fluid") {
    const fluidConfig = resolveConfig(
      newSettings.background.fluidQuality ?? "medium",
      newSettings.background.fluidStyle ?? "standard",
      newSettings.background.fluidAdvanced ?? false,
      newSettings.background.fluidParams ?? {},
    );
    fluidSimulation.value.updateConfig(fluidConfig);
  }
}, { deep: true });

// ─── 暴露方法 ───
defineExpose({
  engine,
  fluidSimulation,
  playRealtimeNote: (midi: number, velocity = 100) => engine.value?.playRealtimeNote(midi, velocity),
  releaseRealtimeNote: (midi: number) => engine.value?.releaseRealtimeNote(midi),
  scheduleSynthesiaNotes: (notes: any[]) => engine.value?.scheduleSynthesiaNotes(notes),
  setTransportTime: (time: number) => engine.value?.setTransportTime(time),
  setTransportPlaying: (playing: boolean) => engine.value?.setTransportPlaying(playing),
  triggerSynthesiaNote: (midi: number, velocity: number) => engine.value?.triggerSynthesiaNote(midi, velocity),
  releaseSynthesiaNote: (midi: number) => engine.value?.releaseSynthesiaNote(midi),
  clearNoteBlocks: () => engine.value?.clearNoteBlocks(),
  setMode: (mode: "realtime" | "synthesia") => engine.value?.setMode(mode),
  getMode: () => engine.value?.getMode(),
});
</script>

<style scoped>
.waterfall-canvas-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

.fluid-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.main-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: auto;
}
</style>