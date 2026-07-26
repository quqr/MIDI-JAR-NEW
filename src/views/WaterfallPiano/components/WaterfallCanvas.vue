<template>
  <!-- z-0 创建 stacking context，将 PixiJS canvas (z-index:1) 与 fluid canvas (z-index:0/2)
       限制在容器内部，避免它们突破到外层覆盖顶部 UI 栏与播放控制面板 -->
  <div ref="containerRef" class="absolute inset-0 overflow-hidden z-0">
    <!-- PixiJS Application canvas is appended here by createWaterfallApp() -->
    <!-- WebGL fluid simulation canvas: independent GL context -->
    <!-- w-full h-full 必需：canvas 是 replaced element，inset:0 不会拉伸其 CSS 尺寸，
         必须显式设置 width/height:100% 以防止 canvas.width 属性反噬 CSS 尺寸导致指数级增长 -->
    <!-- z-index 由 fluidLayerPosition 决定：top=2（流体在 PixiJS 之上），bottom=0（流体在 PixiJS 之下） -->
    <canvas
      v-if="showFluidCanvas"
      ref="fluidRef"
      class="absolute inset-0 w-full h-full pointer-events-none"
      :style="{ zIndex: fluidZIndex }"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { Application, Container } from "pixi.js";
import {
  WaterfallEngine,
  type WaterfallLayers,
} from "../engine/WaterfallEngine";
import { SamplerSoundEngine } from "../audio/SamplerSoundEngine";
import { keyboardMap } from "../constants";
import { createWaterfallApp } from "../engine/PixiAppFactory";
import type { WaterfallPianoSettings } from "../types";
import type { NoteBlockMode } from "../engine/NoteBlockSystem";

const props = defineProps<{
  settings: WaterfallPianoSettings;
  mode: NoteBlockMode;
  showFPS?: boolean;
}>();

const emit = defineEmits<{
  (e: "ready", engine: WaterfallEngine): void;
}>();

const containerRef = ref<HTMLDivElement>();
const fluidRef = ref<HTMLCanvasElement>();
const showFluidCanvas = ref(false);

/**
 * 流体 canvas 的 z-index：
 * - "top": 流体在 PixiJS 之上（z=2，PixiJS=1）
 * - "bottom": 流体在 PixiJS 之下（z=0，PixiJS=1）
 * PixiJS canvas 的 z-index 在 PixiAppFactory 中固定设为 1。
 */
const fluidZIndex = computed(() =>
  props.settings.background.fluidLayerPosition === "top" ? 2 : 0,
);

let engine: WaterfallEngine | null = null;
let soundEngine: SamplerSoundEngine | null = null;
let pixiApp: Application | null = null;
let resizeObserver: ResizeObserver | null = null;
const heldKeys = new Set<string>();
let audioInitialized = false;

function midiFromKey(key: string): number | null {
  const base = keyboardMap[key.toLowerCase()];
  if (base === undefined) return null;
  return base;
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.repeat) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return;
  }
  const midi = midiFromKey(e.key);
  if (midi === null) return;
  e.preventDefault();
  const key = e.key.toLowerCase();
  if (heldKeys.has(key)) return;
  heldKeys.add(key);

  if (!audioInitialized && soundEngine) {
    audioInitialized = true;
    soundEngine.init().catch(() => {
      audioInitialized = false;
    });
  }

  const velocity = props.settings.keyboard.defaultVelocity;
  engine?.triggerNoteOn(midi, velocity);
}

function onKeyUp(e: KeyboardEvent): void {
  const midi = midiFromKey(e.key);
  if (midi === null) return;
  const key = e.key.toLowerCase();
  if (!heldKeys.has(key)) return;
  heldKeys.delete(key);
  engine?.triggerNoteOff(midi);
}

function clearAllHeld(): void {
  for (const key of heldKeys) {
    const midi = midiFromKey(key);
    if (midi !== null) {
      engine?.triggerNoteOff(midi);
    }
  }
  heldKeys.clear();
}

onMounted(async () => {
  if (!containerRef.value) return;

  soundEngine = new SamplerSoundEngine();
  await soundEngine.init();
  audioInitialized = true;

  // 先挂载流体 canvas 并等待 DOM 更新，确保其在 PixiJS canvas 之下
  // （PixiJS canvas 由 createWaterfallApp append 到 containerRef，
  //  后 append 的元素在 DOM 顺序上靠后，视觉上位于上层）
  showFluidCanvas.value = props.settings.background.fluidEnabled;
  if (showFluidCanvas.value) {
    await nextTick();
  }

  // 创建 PixiJS Application（canvas 会 append 到 containerRef 末尾，位于 fluid canvas 之上）
  pixiApp = await createWaterfallApp(containerRef.value);

  // 创建四层 Container
  const backgroundLayer = new Container();
  backgroundLayer.label = "background";
  const fluidLayer = new Container();
  fluidLayer.label = "fluid";
  const waterfallLayer = new Container();
  waterfallLayer.label = "waterfall";
  const keyboardLayer = new Container();
  keyboardLayer.label = "keyboard";

  const layers: WaterfallLayers = {
    background: backgroundLayer,
    fluid: fluidLayer,
    waterfall: waterfallLayer,
    keyboard: keyboardLayer,
  };

  pixiApp.stage.addChild(
    backgroundLayer,
    fluidLayer,
    waterfallLayer,
    keyboardLayer,
  );

  // 初始化引擎
  const fluidCanvas = props.settings.background.fluidEnabled
    ? (fluidRef.value ?? undefined)
    : undefined;

  engine = new WaterfallEngine();
  engine.init(pixiApp, layers, props.settings, fluidCanvas);
  engine.setSoundEngine(soundEngine);
  engine.setMode(props.mode);

  // 初始 resize
  const container = containerRef.value;
  const doResize = () => {
    if (!engine || !container) return;
    const rect = container.getBoundingClientRect();
    engine.resize(Math.max(1, rect.width), Math.max(1, rect.height));
  };
  doResize();
  resizeObserver = new ResizeObserver(doResize);
  resizeObserver.observe(container);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearAllHeld);

  emit("ready", engine);
});

watch(
  () => props.settings,
  async (s) => {
    // 先同步 fluid canvas 显示状态
    const wasFluidShown = showFluidCanvas.value;
    showFluidCanvas.value = s.background.fluidEnabled;
    // 若刚开启流体，需等待 canvas 挂载后再 applySettings，让 engine 能拿到 canvas
    if (s.background.fluidEnabled && !wasFluidShown) {
      await nextTick();
      engine?.setFluidCanvas(fluidRef.value ?? null);
    } else if (!s.background.fluidEnabled) {
      engine?.setFluidCanvas(null);
    }
    engine?.applySettings(s);
  },
  { deep: true },
);

watch(
  () => props.mode,
  (m) => engine?.setMode(m),
);

watch(
  () => props.showFPS,
  (show) => {
    if (engine) engine.showFPS = show;
  },
  { immediate: true },
);

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", clearAllHeld);
  resizeObserver?.disconnect();
  resizeObserver = null;
  clearAllHeld();
  engine?.dispose();
  engine = null;
  soundEngine?.dispose();
  soundEngine = null;
  if (pixiApp) {
    pixiApp.destroy(true, { children: true, texture: true });
    pixiApp = null;
  }
});

defineExpose({
  getEngine: () => engine,
  getSoundEngine: () => soundEngine,
  retryAudio: async () => {
    if (soundEngine) {
      try {
        await soundEngine.init();
        audioInitialized = true;
      } catch {
        // ignore
      }
    }
  },
});
</script>
