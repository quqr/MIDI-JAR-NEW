<template>
  <div ref="containerRef" class="absolute inset-0 overflow-hidden">
    <canvas ref="bgRef" class="absolute inset-0 pointer-events-none" />
    <canvas ref="fluidRef" class="absolute inset-0 pointer-events-none" />
    <canvas ref="waterfallRef" class="absolute pointer-events-none" />
    <canvas ref="keyboardRef" class="absolute" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { WaterfallEngine } from "../engine/WaterfallEngine";
import { SoundEngine } from "../audio/SoundEngine";
import { keyboardMap } from "../constants";
import type { WaterfallPianoSettings } from "../types";
import type { NoteBlockMode } from "../engine/NoteBlockSystem";

const props = defineProps<{
  settings: WaterfallPianoSettings;
  mode: NoteBlockMode;
  showFPS?: boolean;
}>();

const emit = defineEmits<{
  (e: "noteOn", midi: number, velocity: number): void;
  (e: "noteOff", midi: number): void;
  (e: "ready", engine: WaterfallEngine): void;
}>();

const containerRef = ref<HTMLDivElement>();
const bgRef = ref<HTMLCanvasElement>();
const fluidRef = ref<HTMLCanvasElement>();
const waterfallRef = ref<HTMLCanvasElement>();
const keyboardRef = ref<HTMLCanvasElement>();

let engine: WaterfallEngine | null = null;
let soundEngine: SoundEngine | null = null;
let resizeObserver: ResizeObserver | null = null;
const heldKeys = new Set<string>();
let audioInitialized = false;

/**
 * 将电脑键盘按键映射为 MIDI 音符号
 * @param key - 键盘按键名称（如 "a", "w"）
 * @returns 对应的 MIDI 编号，无映射时返回 null
 */
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

  // Initialize audio on first user interaction (user gesture)
  if (!audioInitialized && soundEngine) {
    audioInitialized = true;
    soundEngine.init(props.settings.sound).catch(() => {
      audioInitialized = false;
    });
  }

  const velocity = props.settings.keyboard.defaultVelocity;
  engine?.triggerNoteOn(midi, velocity);
  emit("noteOn", midi, velocity);
}

function onKeyUp(e: KeyboardEvent): void {
  const midi = midiFromKey(e.key);
  if (midi === null) return;
  const key = e.key.toLowerCase();
  if (!heldKeys.has(key)) return;
  heldKeys.delete(key);
  engine?.triggerNoteOff(midi);
  emit("noteOff", midi);
}

/**
 * 释放所有正在按住的键，逐个触发 noteOff 并清空 heldKeys 集合
 */
function clearAllHeld(): void {
  for (const key of heldKeys) {
    const midi = midiFromKey(key);
    if (midi !== null) {
      engine?.triggerNoteOff(midi);
      emit("noteOff", midi);
    }
  }
  heldKeys.clear();
}

onMounted(async () => {
  if (
    !containerRef.value ||
    !bgRef.value ||
    !fluidRef.value ||
    !waterfallRef.value ||
    !keyboardRef.value
  ) {
    return;
  }

  soundEngine = new SoundEngine();
  // AudioContext initialization deferred to first user interaction (keyboard press)
  // to comply with browser autoplay policy

  engine = new WaterfallEngine();
  engine.init(
    {
      background: bgRef.value,
      fluid: fluidRef.value,
      waterfall: waterfallRef.value,
      keyboard: keyboardRef.value,
    },
    props.settings,
  );
  engine.setSoundEngine(soundEngine);
  engine.setMode(props.mode);
  engine.callbacks = {
    onNoteOn: (midi, vel) => emit("noteOn", midi, vel),
    onNoteOff: (midi) => emit("noteOff", midi),
  };

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
  (s) => engine?.applySettings(s),
  { deep: true },
);

watch(
  () => props.settings.sound,
  (s) => soundEngine?.updateConfig(s),
  { deep: true },
);

watch(
  () => props.mode,
  (m) => engine?.setMode(m),
);

// FPS 显示通过 engine.showFPS 控制，不需要独立 RAF 循环
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
