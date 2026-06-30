<template>
  <div ref="containerRef" class="w-full h-full bg-base-300">
    <canvas ref="canvasRef" class="w-full h-full" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { WaterfallEngine } from "../engine/WaterfallEngine";
import { keyboardMap, KEYBOARD_RANGES } from "../constants";
import { useWaterfallPianoStore } from "../stores/waterfallPiano";

const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();

const store = useWaterfallPianoStore();
let engine: WaterfallEngine | null = null;
const pressedKeys = new Set<string>();

const emit = defineEmits<{
  noteOn: [midi: number, velocity: number];
  noteOff: [midi: number];
}>();

defineExpose({
  containerRef,
  canvasRef,
  getEngine: () => engine,
});

onMounted(async () => {
  if (!canvasRef.value) return;

  engine = new WaterfallEngine();
  await engine.init(canvasRef.value, store.settings);

  const observer = new ResizeObserver(() => {
    engine?.resize();
  });
  if (containerRef.value) {
    observer.observe(containerRef.value);
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  engine?.destroy();
  engine = null;
});

watch(
  () => store.settings,
  (settings) => {
    engine?.applySettings(settings);
  },
  { deep: true },
);

// ─── 获取当前键盘范围 ───
function getKeyboardRange(): { from: number; to: number } {
  const range = KEYBOARD_RANGES[store.settings.keyboard.range];
  return range || KEYBOARD_RANGES["88"];
}

// ─── 检查 MIDI 是否在键盘范围内 ───
function isMidiInRange(midi: number): boolean {
  const { from, to } = getKeyboardRange();
  return midi >= from && midi <= to;
}

// ─── 八度偏移限制 ───
function clampOctaveOffset(offset: number): number {
  // 基础音域是 C4 (60) 附近
  // 限制偏移使得最低音和最高音仍在键盘上
  const { from, to } = getKeyboardRange();
  const baseNote = 60; // C4
  const minOffset = Math.ceil((from - baseNote) / 12);
  const maxOffset = Math.floor((to - baseNote - 12) / 12);
  return Math.max(minOffset, Math.min(maxOffset, offset));
}

function handleKeyDown(e: KeyboardEvent) {
  if (!engine) return;

  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  )
    return;

  if (e.code === "Space" || e.code === "Enter" || e.code === "Escape") return;

  const key = e.key.toLowerCase();

  // 八度偏移（带限制）
  if (key === "z") {
    store.octaveOffset = clampOctaveOffset(store.octaveOffset - 1);
    return;
  }
  if (key === "x") {
    store.octaveOffset = clampOctaveOffset(store.octaveOffset + 1);
    return;
  }

  // 键盘可见性
  if (key === "o") {
    store.updateSetting(
      "keyboard",
      "visible",
      !store.settings.keyboard.visible,
    );
    return;
  }

  // 钢琴键
  if (key in keyboardMap && !pressedKeys.has(key)) {
    pressedKeys.add(key);
    const midi = keyboardMap[key] + store.octaveOffset * 12;
    if (isMidiInRange(midi)) {
      engine.playRealtimeNote(midi, 100);
      emit("noteOn", midi, 100);
    }
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (!engine) return;

  const key = e.key.toLowerCase();

  if (key in keyboardMap) {
    pressedKeys.delete(key);
    const midi = keyboardMap[key] + store.octaveOffset * 12;
    if (isMidiInRange(midi)) {
      engine.releaseRealtimeNote(midi);
      emit("noteOff", midi);
    }
  }
}
</script>
