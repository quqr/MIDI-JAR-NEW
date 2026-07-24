<template>
  <div ref="containerRef" class="absolute inset-0 overflow-hidden">
    <!-- PixiJS Application canvas is appended here by createWaterfallApp() -->
    <!-- Separate canvas for fluid simulation (until PixiJS fluid migration is complete) -->
    <canvas v-if="showFluidCanvas" ref="fluidRef" class="absolute inset-0 pointer-events-none" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { Application, Container } from "pixi.js";
import { WaterfallEngine, type WaterfallLayers } from "../engine/WaterfallEngine";
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

  // 创建 PixiJS Application
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

  pixiApp.stage.addChild(backgroundLayer, fluidLayer, waterfallLayer, keyboardLayer);

  // 初始化引擎
  const fluidCanvas = props.settings.background.fluidEnabled ? fluidRef.value ?? undefined : undefined;
  showFluidCanvas.value = props.settings.background.fluidEnabled;

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
  (s) => {
    engine?.applySettings(s);
    showFluidCanvas.value = s.background.fluidEnabled;
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
