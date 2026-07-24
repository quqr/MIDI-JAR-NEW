<template>
  <div class="flex flex-col h-full">
    <div class="text-xs font-semibold text-base-content/80 px-2 py-1 bg-base-300/50 rounded-t-lg">
      PixiJS 移植版 (PixiFluidSimulation)
    </div>
    <div ref="containerRef" class="relative flex-1 overflow-hidden bg-black rounded-b-lg" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { Application, Container } from "pixi.js";
import { PixiFluidSimulation } from "@/engine/fluid-pixi/PixiFluidSimulation";
import type { FluidSimulationConfig } from "@/engine/fluid/FluidConfig";
import type { FluidFrameStats, RGB } from "../types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("PixiFluidPanel");

const props = defineProps<{
  config: FluidSimulationConfig;
}>();

const emit = defineEmits<{
  (e: "frame-stats", stats: FluidFrameStats): void;
  (e: "splat-registered", params: { x: number; y: number; dx: number; dy: number; color: RGB }): void;
  (e: "ready", splatFn: (x: number, y: number, dx: number, dy: number, color: RGB) => void): void;
}>();

const containerRef = ref<HTMLDivElement>();

let app: Application | null = null;
let fluid: PixiFluidSimulation | null = null;
let rafId = 0;
let lastFrameTime = 0;
let frameCount = 0;
let fpsAccum = 0;
let fpsTimer = 0;
let currentFps = 0;
let splatCount = 0;
let diagnosticsFrameCounter = 0;

// ── 指针状态（与 WebGLFluidPanel 完全相同，Y向上约定）──
interface Pointer {
  id: number;
  texcoordX: number;
  texcoordY: number;
  prevTexcoordX: number;
  prevTexcoordY: number;
  deltaX: number;
  deltaY: number;
  down: boolean;
  moved: boolean;
  color: RGB;
}

const pointers: Pointer[] = [];
let colorUpdateTimer = 0;

/** HSV 转 RGB（0-1） */
function hsvToRgb(h: number, s: number, v: number): RGB {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r, g, b };
}

/** 生成随机颜色（与原始项目一致：×0.15 压暗） */
function generateColor(): RGB {
  const c = hsvToRgb(Math.random(), 1.0, 1.0);
  return { r: c.r * 0.15, g: c.g * 0.15, b: c.b * 0.15 };
}

/** 宽高比补偿 deltaX */
function correctDeltaX(delta: number, aspectRatio: number): number {
  if (aspectRatio < 1) delta *= aspectRatio;
  return delta;
}

/** 宽高比补偿 deltaY */
function correctDeltaY(delta: number, aspectRatio: number): number {
  if (aspectRatio > 1) delta /= aspectRatio;
  return delta;
}

/** 获取或创建指针 */
function getPointer(id: number): Pointer {
  let p = pointers.find((p) => p.id === id);
  if (!p) {
    p = {
      id, texcoordX: 0, texcoordY: 0, prevTexcoordX: 0, prevTexcoordY: 0,
      deltaX: 0, deltaY: 0, down: false, moved: false, color: generateColor(),
    };
    pointers.push(p);
  }
  return p;
}

/** 获取 canvas 尺寸（device pixels） */
function getCanvasSize(): { w: number; h: number } {
  if (app?.canvas) {
    return { w: app.canvas.width, h: app.canvas.height };
  }
  return { w: 1, h: 1 };
}

/** 更新指针按下数据 */
function updatePointerDown(pointer: Pointer, posX: number, posY: number): void {
  const { w, h } = getCanvasSize();
  pointer.down = true;
  pointer.moved = false;
  pointer.texcoordX = posX / w;
  pointer.texcoordY = 1.0 - posY / h; // Y 翻转（Y向上约定）
  pointer.prevTexcoordX = pointer.texcoordX;
  pointer.prevTexcoordY = pointer.texcoordY;
  pointer.deltaX = 0;
  pointer.deltaY = 0;
  pointer.color = generateColor();
}

/** 更新指针移动数据 */
function updatePointerMove(pointer: Pointer, posX: number, posY: number): void {
  const { w, h } = getCanvasSize();
  pointer.prevTexcoordX = pointer.texcoordX;
  pointer.prevTexcoordY = pointer.texcoordY;
  pointer.texcoordX = posX / w;
  pointer.texcoordY = 1.0 - posY / h;
  const aspectRatio = w / h;
  pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX, aspectRatio);
  pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY, aspectRatio);
  pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
}

/** 通过指针注入 splat */
function splatPointer(pointer: Pointer): void {
  const dx = pointer.deltaX * props.config.SPLAT_FORCE;
  const dy = pointer.deltaY * props.config.SPLAT_FORCE;
  performSplat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
}

/** 执行 splat 并记录日志 */
function performSplat(x: number, y: number, dx: number, dy: number, color: RGB): void {
  if (!fluid) return;
  // PixiFluidSimulation.splat() 内部做 Y向上→Y向下 转换
  fluid.splat(x, y, dx, dy, color);
  splatCount++;
  emit("splat-registered", { x, y, dx, dy, color });
}

/** 每帧应用输入 */
function applyInputs(dt: number): void {
  if (props.config.COLORFUL) {
    colorUpdateTimer += dt * props.config.COLOR_UPDATE_SPEED;
    if (colorUpdateTimer >= 1) {
      colorUpdateTimer = 0;
      pointers.forEach((p) => { p.color = generateColor(); });
    }
  }
  pointers.forEach((p) => {
    if (p.moved) {
      p.moved = false;
      splatPointer(p);
    }
  });
}

/** 主循环（手动 rAF，与 WebGL 侧公平对比） */
function loop(): void {
  if (!fluid || !app) return;

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.016666);
  lastFrameTime = now;

  // FPS 计算
  frameCount++;
  fpsAccum += dt;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    currentFps = Math.round(frameCount / fpsAccum);
    frameCount = 0;
    fpsAccum = 0;
    fpsTimer = 0;
  }

  applyInputs(dt);
  fluid.update();
  app.renderer.render({ container: app.stage });

  // 每 30 帧采样一次诊断数据
  diagnosticsFrameCounter++;
  let diagnostics: FluidFrameStats["diagnostics"];
  if (diagnosticsFrameCounter >= 30) {
    diagnosticsFrameCounter = 0;
    try {
      diagnostics = fluid.getDiagnostics(app.renderer);
    } catch {
      // 诊断采样失败时静默跳过
    }
  }

  // 报告帧统计
  const stats: FluidFrameStats = {
    fps: currentFps,
    dt,
    splatCount,
    dyeResolution: props.config.DYE_RESOLUTION,
    simResolution: props.config.SIM_RESOLUTION,
    diagnostics,
  };
  emit("frame-stats", stats);

  rafId = requestAnimationFrame(loop);
}

/** 设置鼠标/触摸事件 */
function setupInput(): void {
  const canvas = app!.canvas;
  const dpr = window.devicePixelRatio;

  canvas.addEventListener("mousedown", (e) => {
    const posX = e.offsetX * dpr;
    const posY = e.offsetY * dpr;
    const pointer = getPointer(-1);
    updatePointerDown(pointer, posX, posY);
  });

  canvas.addEventListener("mousemove", (e) => {
    const pointer = pointers[0];
    if (!pointer || !pointer.down) return;
    const posX = e.offsetX * dpr;
    const posY = e.offsetY * dpr;
    updatePointerMove(pointer, posX, posY);
  });

  canvas.addEventListener("mouseup", () => {
    const pointer = pointers[0];
    if (pointer) pointer.down = false;
  });

  canvas.addEventListener("mouseleave", () => {
    const pointer = pointers[0];
    if (pointer) pointer.down = false;
  });

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touches = e.targetTouches;
    const r = canvas.getBoundingClientRect();
    for (let i = 0; i < touches.length; i++) {
      const posX = (touches[i].clientX - r.left) * dpr;
      const posY = (touches[i].clientY - r.top) * dpr;
      const pointer = getPointer(touches[i].identifier);
      updatePointerDown(pointer, posX, posY);
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touches = e.targetTouches;
    const r = canvas.getBoundingClientRect();
    for (let i = 0; i < touches.length; i++) {
      const pointer = pointers.find((p) => p.id === touches[i].identifier);
      if (!pointer || !pointer.down) continue;
      const posX = (touches[i].clientX - r.left) * dpr;
      const posY = (touches[i].clientY - r.top) * dpr;
      updatePointerMove(pointer, posX, posY);
    }
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const pointer = pointers.find((p) => p.id === touches[i].identifier);
      if (pointer) pointer.down = false;
    }
  });
}

onMounted(async () => {
  const container = containerRef.value;
  if (!container) return;

  try {
    // 创建 PixiJS Application（手动 rAF，autoStart:false）
    app = new Application();
    await app.init({
      resizeTo: container,
      antialias: false,
      backgroundAlpha: 0,
      preference: "webgl",
      resolution: window.devicePixelRatio,
      autoDensity: true,
      autoStart: false,
    });
    container.appendChild(app.canvas);

    // 创建 fluidLayer Container
    const fluidLayer = new Container();
    fluidLayer.label = "fluid";
    app.stage.addChild(fluidLayer);

    // 创建 PixiFluidSimulation
    fluid = new PixiFluidSimulation(app, fluidLayer, props.config);
    fluid.start();
    fluid.multipleSplats(5);

    setupInput();
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(loop);

    // 暴露 splat 函数给父组件（同步喷射用）
    emit("ready", (x, y, dx, dy, color) => {
      performSplat(x, y, dx, dy, color);
    });
    logger.info("PixiJS FluidSimulation started");
  } catch (e) {
    logger.error({ err: e }, "Failed to start PixiJS FluidSimulation");
  }
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  if (fluid) {
    fluid.destroy();
    fluid = null;
  }
  if (app) {
    app.destroy(true, { children: true, texture: true });
    app = null;
  }
  pointers.length = 0;
  logger.info("PixiJS FluidSimulation destroyed");
});

// 监听配置变化
watch(
  () => props.config,
  (newConfig) => {
    if (!fluid || !app) return;
    // updateConfig 内部已处理分辨率变化时的 resize
    fluid.updateConfig(newConfig);
    // 更新 Sprite scale 以适配容器尺寸
    const screen = app.screen;
    fluid.resize(screen.width, screen.height);
  },
  { deep: true },
);
</script>
