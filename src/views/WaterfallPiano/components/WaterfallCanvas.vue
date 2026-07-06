<template>
  <div
    ref="containerRef"
    class="w-full h-full bg-base-300 relative"
    @contextmenu.prevent="onContextMenu"
  >
    <canvas
      ref="canvasRef"
      class="w-full h-full cursor-pointer"
      role="img"
      :aria-label="canvasAriaLabel"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
      @click="onCanvasClick"
    />

    <!-- 悬停音符 Tooltip -->
    <div
      v-if="tooltip.visible"
      class="absolute pointer-events-none z-20 px-2 py-1 rounded-md bg-base-100/95 text-base-content text-xs font-mono shadow-lg border border-base-200 backdrop-blur-sm"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      role="tooltip"
    >
      <span class="font-semibold">{{ tooltip.text }}</span>
    </div>

    <!-- 右键上下文菜单 -->
    <Transition name="context-menu">
      <div
        v-if="contextMenu.visible"
        class="fixed z-50 min-w-[180px] py-1 rounded-lg bg-base-100 shadow-xl border border-base-200 overflow-hidden glass"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        role="menu"
        @click.stop
      >
        <button
          class="w-full px-3 py-2 text-left text-sm hover:bg-base-200 flex items-center gap-2"
          role="menuitem"
          @click="onMenuAction('record')"
        >
          <Icon name="circle" :size="14" class="text-error" aria-hidden="true" />
          {{ t("waterfallPiano.toggleRecord") }}
        </button>
        <button
          class="w-full px-3 py-2 text-left text-sm hover:bg-base-200 flex items-center gap-2"
          role="menuitem"
          @click="onMenuAction('playback')"
        >
          <Icon name="play" :size="14" aria-hidden="true" />
          {{ t("waterfallPiano.togglePlayback") }}
        </button>
        <div class="my-1 border-t border-base-200"></div>
        <button
          class="w-full px-3 py-2 text-left text-sm hover:bg-base-200 flex items-center gap-2"
          role="menuitem"
          @click="onMenuAction('settings')"
        >
          <Icon name="settings" :size="14" aria-hidden="true" />
          {{ t("waterfallPiano.openSettings") }}
        </button>
        <button
          class="w-full px-3 py-2 text-left text-sm hover:bg-base-200 flex items-center gap-2"
          role="menuitem"
          @click="onMenuAction('reset')"
        >
          <Icon name="reset" :size="14" aria-hidden="true" />
          {{ t("waterfallPiano.resetView") }}
        </button>
      </div>
    </Transition>

    <!-- 屏幕阅读器实时播报区域 -->
    <div class="sr-only" aria-live="polite" aria-atomic="false">
      <span v-for="note in activeNotesSr" :key="note">{{ note }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { WaterfallEngine } from "../engine/WaterfallEngine";
import { keyboardMap, KEYBOARD_RANGES } from "../constants";
import { useWaterfallPianoStore } from "../stores/waterfallPiano";
import Icon from "@/components/Icon/Icon.vue";

const { t } = useI18n();

const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();

const store = useWaterfallPianoStore();
let engine: WaterfallEngine | null = null;
const pressedKeys = new Set<string>();

// 保存需在 onUnmounted 中清理的引用
let resizeObserver: ResizeObserver | null = null;
const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

// 鼠标悬停状态
const tooltip = ref({ visible: false, x: 0, y: 0, text: "" });

// 右键菜单状态
const contextMenu = ref({ visible: false, x: 0, y: 0 });

// 屏幕阅读器播报的活动音符
const activeNotesSr = ref<string[]>([]);

const emit = defineEmits<{
  noteOn: [midi: number, velocity: number];
  noteOff: [midi: number];
  contextAction: [action: "record" | "playback" | "settings" | "reset"];
}>();

defineExpose({
  containerRef,
  canvasRef,
  getEngine: () => engine,
});

// Canvas 的 ARIA 描述
const canvasAriaLabel = computed(() => {
  if (activeNotesSr.value.length > 0) {
    return t("waterfallPiano.canvasPlaying", {
      notes: activeNotesSr.value.join(", "),
    });
  }
  return t("waterfallPiano.canvasIdle");
});

onMounted(async () => {
  if (!canvasRef.value) return;

  engine = new WaterfallEngine();
  await engine.init(canvasRef.value, store.settings);

  resizeObserver = new ResizeObserver(() => {
    engine?.resize();
  });
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("click", closeContextMenu);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  window.removeEventListener("click", closeContextMenu);

  // 断开 ResizeObserver，防止观察者泄漏
  resizeObserver?.disconnect();
  resizeObserver = null;

  // 清除所有未完成的 setTimeout，防止回调在 engine 销毁后执行
  for (const id of pendingTimeouts) {
    clearTimeout(id);
  }
  pendingTimeouts.clear();

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
  const { from, to } = getKeyboardRange();
  const baseNote = 60; // C4
  const minOffset = Math.ceil((from - baseNote) / 12);
  const maxOffset = Math.floor((to - baseNote - 12) / 12);
  return Math.max(minOffset, Math.min(maxOffset, offset));
}

// ─── MIDI 转音符名 ───
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

// ─── 鼠标移动处理：检测悬停的钢琴键 ───
function onMouseMove(e: MouseEvent) {
  if (!engine?.keyboardRenderer) {
    tooltip.value.visible = false;
    return;
  }

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const midi = engine.keyboardRenderer.getNoteAtPoint(x, y);
  if (midi !== null && midi !== undefined) {
    const noteName = midiToNoteName(midi);
    tooltip.value = {
      visible: true,
      x: x + 12,
      y: y - 30,
      text: noteName,
    };
  } else {
    tooltip.value.visible = false;
  }
}

function onMouseLeave() {
  tooltip.value.visible = false;
}

// ─── Canvas 点击：触发音符 ───
function onCanvasClick(e: MouseEvent) {
  if (!engine?.keyboardRenderer) return;
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const midi = engine.keyboardRenderer.getNoteAtPoint(x, y);
  if (midi !== null && midi !== undefined) {
    engine.playRealtimeNote(midi, 100);
    emit("noteOn", midi, 100);
    // 短暂延迟后释放
    const timeoutId = setTimeout(() => {
      engine?.releaseRealtimeNote(midi);
      emit("noteOff", midi);
      pendingTimeouts.delete(timeoutId);
    }, 200);
    pendingTimeouts.add(timeoutId);
  }
}

// ─── 右键上下文菜单 ───
function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  contextMenu.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
  };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
}

function onMenuAction(action: "record" | "playback" | "settings" | "reset") {
  contextMenu.value.visible = false;
  emit("contextAction", action);
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

  if (key === "z") {
    store.octaveOffset = clampOctaveOffset(store.octaveOffset - 1);
    return;
  }
  if (key === "x") {
    store.octaveOffset = clampOctaveOffset(store.octaveOffset + 1);
    return;
  }

  if (key === "o") {
    store.updateSetting(
      "keyboard",
      "visible",
      !store.settings.keyboard.visible,
    );
    return;
  }

  if (key in keyboardMap && !pressedKeys.has(key)) {
    pressedKeys.add(key);
    const midi = keyboardMap[key] + store.octaveOffset * 12;
    if (isMidiInRange(midi)) {
      engine.playRealtimeNote(midi, 100);
      emit("noteOn", midi, 100);
      // 更新屏幕阅读器播报
      const noteName = midiToNoteName(midi);
      activeNotesSr.value = [...activeNotesSr.value, noteName].slice(-5);
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
      // 从播报列表移除
      const noteName = midiToNoteName(midi);
      activeNotesSr.value = activeNotesSr.value.filter((n) => n !== noteName);
    }
  }
}
</script>

<style scoped>
.context-menu-enter-active,
.context-menu-leave-active {
  transition: all 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
