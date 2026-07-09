<template>
  <div class="w-full h-screen bg-black relative">
    <canvas
      ref="fluidCanvas"
      class="absolute inset-0 w-full h-full"
      style="z-index: 0"
    />
    <div class="absolute top-4 left-4 z-10 bg-black/50 p-4 rounded-lg text-white">
      <h2 class="text-lg font-bold mb-2">流体模拟测试</h2>
      <p class="text-sm mb-2">点击/拖动 canvas 注入流体</p>
      <p class="text-xs">FPS: {{ fps }}</p>
      <button
        class="mt-2 px-3 py-1 bg-blue-500 rounded text-sm hover:bg-blue-600"
        @click="addRandomSplats"
      >
        添加随机 splat
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { FluidSimulation } from "@/views/WaterfallPiano/engine/fluid/FluidSimulation";
import { resolveConfig, DEFAULT_CONFIG } from "@/views/WaterfallPiano/engine/fluid/FluidConfig";
import { HSVtoRGB } from "@/views/WaterfallPiano/engine/fluid/FluidSolver";

const fluidCanvas = ref<HTMLCanvasElement | null>(null);
const fps = ref(0);
let fluidSimulation: FluidSimulation | null = null;
let frameCount = 0;
let lastFpsTime = Date.now();

onMounted(() => {
  if (!fluidCanvas.value) return;

  console.log("[FLUID-TEST] Initializing FluidSimulation...");
  console.log("[FLUID-TEST] Canvas size:", fluidCanvas.value.clientWidth, "x", fluidCanvas.value.clientHeight);

  try {
    fluidSimulation = new FluidSimulation(
      fluidCanvas.value,
      resolveConfig("medium", "standard"),
    );
    console.log("[FLUID-TEST] FluidSimulation created");
    fluidSimulation.start();
    console.log("[FLUID-TEST] FluidSimulation started");

    // 添加初始 splats
    fluidSimulation.multipleSplats(5);
    console.log("[FLUID-TEST] Initial splats added");

    // 鼠标交互
    fluidCanvas.value.addEventListener("mousedown", onMouseDown);
    fluidCanvas.value.addEventListener("mousemove", onMouseMove);
    fluidCanvas.value.addEventListener("mouseup", onMouseUp);

    // FPS 计数
    setInterval(() => {
      const now = Date.now();
      fps.value = Math.round(frameCount * 1000 / (now - lastFpsTime));
      frameCount = 0;
      lastFpsTime = now;
    }, 1000);

    // 监听渲染帧数
    const countFrames = () => {
      frameCount++;
      requestAnimationFrame(countFrames);
    };
    requestAnimationFrame(countFrames);

  } catch (e) {
    console.error("[FLUID-TEST] Failed to initialize:", e);
  }
});

onUnmounted(() => {
  fluidSimulation?.destroy();
  fluidCanvas.value?.removeEventListener("mousedown", onMouseDown);
  fluidCanvas.value?.removeEventListener("mousemove", onMouseMove);
  fluidCanvas.value?.removeEventListener("mouseup", onMouseUp);
});

let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

function onMouseDown(e: MouseEvent) {
  isMouseDown = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  splatAt(e.clientX, e.clientY, 0, 0);
}

function onMouseMove(e: MouseEvent) {
  if (!isMouseDown) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  splatAt(e.clientX, e.clientY, dx * 10, dy * 10);
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
}

function onMouseUp() {
  isMouseDown = false;
}

function splatAt(x: number, y: number, dx: number, dy: number) {
  if (!fluidSimulation || !fluidCanvas.value) return;
  const canvas = fluidCanvas.value;
  const normalizedX = x / canvas.clientWidth;
  const normalizedY = 1.0 - y / canvas.clientHeight; // Y 轴翻转

  const color = HSVtoRGB(Math.random(), 1.0, 1.0);
  color.r *= 10;
  color.g *= 10;
  color.b *= 10;

  console.log("[FLUID-TEST] splat at", normalizedX, normalizedY, "dx:", dx, "dy:", dy);
  fluidSimulation.splat(normalizedX, normalizedY, dx, dy, color);
}

function addRandomSplats() {
  if (!fluidSimulation) return;
  fluidSimulation.multipleSplats(5);
  console.log("[FLUID-TEST] Added 5 random splats");
}
</script>