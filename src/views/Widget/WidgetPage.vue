<template>
  <div
    class="h-full w-full flex flex-col overflow-hidden widget-root"
    :class="isLocked ? 'cursor-default' : ''"
    :style="rootStyle"
  >
    <WidgetTitleBar
      :title="widgetTitle"
      :type="type"
      :isMaximized="isMaximized"
      :alwaysOnTop="alwaysOnTop"
      :autoHide="autoHide"
      :positionLocked="isLocked"
      :opacity="opacity"
      :transparentMode="transparentMode"
      :showPin="true"
      :showAutoHide="true"
      :showLock="true"
      :showOpacity="true"
      @close="handleClose"
      @minimize="handleMinimize"
      @toggleMaximize="handleToggleMaximize"
      @toggleAlwaysOnTop="handleToggleAlwaysOnTop"
      @toggleAutoHide="handleToggleAutoHide"
      @toggleLock="handleToggleLock"
      @changeOpacity="handleChangeOpacity"
      @toggleTransparentMode="handleToggleTransparentMode"
    />
    <div class="flex-1 min-h-0 overflow-hidden widget-content">
      <div v-if="isKeyboard" class="h-full w-full p-1 keyboard-container">
        <PianoKeyboard
          :sustained="sustainedMidiNotes as unknown as number[]"
          :played="playedMidiNotes as unknown as number[]"
          :midi="midiNotes as unknown as number[]"
          :chord="chords[0] as any"
          :keySignature="keySignature as any"
          :keyboard="keyboardSettings as any"
        />
      </div>
      <div v-else-if="isNotation" class="h-full w-full flex items-center justify-center p-1">
        <Notation
          :midiNotes="midiNotes as number[]"
          :keySignature="keySignature"
          :staffClef="staffClef"
          :staffTranspose="staffTranspose"
          :display="notationDisplay"
          :layout="notationLayout"
          :style="notationStyle"
        />
      </div>
      <div v-else-if="isChord" ref="chordContainerRef" class="h-full w-full flex items-center justify-center p-2">
        <div class="flex items-center justify-center font-bold chord-text">
          <ChordNameLink :chord="chords[0] as any" :notation="chordNotation" :highlightAlterations="highlightAlterations" />
        </div>
      </div>
      <div v-else-if="isIntervals" ref="intervalsContainerRef" class="h-full w-full flex items-center justify-center p-2 interval-text">
        <ChordIntervals :intervals="chords[0]?.intervals as unknown as string[]" :pitchClasses="pitchClasses as unknown as string[]" :tonic="chords[0]?.tonic" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import WidgetTitleBar from "./WidgetTitleBar.vue";
import PianoKeyboard from "@/components/PianoKeyboard/PianoKeyboard.vue";
import Notation from "@/components/Notation/Notation.vue";
import ChordNameLink from "@/components/ChordNameLink/ChordNameLink.vue";
import ChordIntervals from "@/components/ChordIntervals/ChordIntervals.vue";
import { useNotes } from "@/composables/useNotes";
import { useSettingsStore } from "@/stores";
import { isTauri } from "@/utils/tauri";
import type { WidgetType } from "@/types/widget";

const route = useRoute();
const props = defineProps<{
  type: WidgetType;
  moduleId: string;
}>();

const type = computed(() => (route.params.type as WidgetType) || props.type);
const moduleId = computed(() => (route.params.moduleId as string) || props.moduleId);

const isKeyboard = computed(() => type.value === "keyboard");
const isNotation = computed(() => type.value === "notation");
const isChord = computed(() => type.value === "chord");
const isIntervals = computed(() => type.value === "intervals");

const settingsStore = useSettingsStore();

const chordContainerRef = ref<HTMLElement | null>(null);
const intervalsContainerRef = ref<HTMLElement | null>(null);
const isMaximized = ref(false);
const alwaysOnTop = ref(true);
const autoHide = ref(false);
const isLocked = ref(false);
const opacity = ref(1);
const transparentMode = ref(false);
let unlisten: (() => void)[] = [];
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
let savedOpacity = 1;
let textResizeObserver: ResizeObserver | null = null;

const moduleSettings = computed(() => {
  return settingsStore.settings.chordDisplay.find((m: any) => m.id === moduleId.value);
});

const keyboardSettings = computed(() => moduleSettings.value?.keyboard ?? {});
const chordNotation = computed(() => moduleSettings.value?.chordNotation ?? "preferred");
const highlightAlterations = computed(() => moduleSettings.value?.highlightAlterations ?? true);

const notationDisplay = computed(() => settingsStore.settings.notation?.display ?? {});
const notationLayout = computed(() => settingsStore.settings.notation?.layout ?? {});
const notationStyle = computed(() => settingsStore.settings.notation?.style ?? {});
const staffClef = computed(() => settingsStore.settings.notation?.staffClef ?? "treble");
const staffTranspose = computed(() => settingsStore.settings.notation?.staffTranspose ?? 0);

const {
  midiNotes,
  pitchClasses,
  chords,
  sustainedMidiNotes,
  playedMidiNotes,
  keySignature,
} = useNotes({
  accidentals: () => settingsStore.settings.notation.accidentals,
  key: () => settingsStore.settings.notation.key,
  useSustain: () => moduleSettings.value?.useSustain ?? true,
  detectOnRelease: () => moduleSettings.value?.detectOnRelease ?? true,
  namespace: `chord-display/${moduleId.value}`,
});

const widgetTitle = computed(() => {
  const titles: Record<WidgetType, string> = {
    keyboard: "Keyboard",
    notation: "Notation",
    chord: "Chord",
    intervals: "Intervals",
  };
  return titles[type.value] || "Widget";
});

const bgAlpha = computed(() => {
  if (autoHide.value) return 0.15;
  return transparentMode.value ? 1 : opacity.value;
});

const contentOpacity = computed(() => {
  if (autoHide.value) return 0.15;
  return transparentMode.value ? opacity.value : 1;
});

const rootStyle = computed(() => ({
  "--bg-alpha": bgAlpha.value,
  "--content-alpha": contentOpacity.value,
}));

async function handleClose() {
  if (!isTauri()) return;
  const win = getCurrentWindow();
  await win.close();
}

async function handleMinimize() {
  if (!isTauri()) return;
  const win = getCurrentWindow();
  await win.minimize();
}

async function handleToggleMaximize() {
  if (!isTauri()) return;
  const win = getCurrentWindow();
  await win.toggleMaximize();
  isMaximized.value = await win.isMaximized();
}

async function handleToggleAlwaysOnTop() {
  if (!isTauri()) return;
  alwaysOnTop.value = !alwaysOnTop.value;
  const win = getCurrentWindow();
  await win.setAlwaysOnTop(alwaysOnTop.value);
}

async function handleToggleAutoHide() {
  autoHide.value = !autoHide.value;
  if (!autoHide.value) {
    opacity.value = savedOpacity;
  }
}

async function handleToggleLock() {
  if (!isTauri()) return;
  isLocked.value = !isLocked.value;
  const win = getCurrentWindow();
  await win.setResizable(!isLocked.value);
}

async function handleChangeOpacity(value: number) {
  opacity.value = value;
  savedOpacity = value;
}

function handleToggleTransparentMode() {
  transparentMode.value = !transparentMode.value;
}

function startAutoHideTimer() {
  if (!autoHide.value) return;
  clearAutoHideTimer();
  autoHideTimer = setTimeout(() => {
    savedOpacity = opacity.value;
    opacity.value = 0.15;
  }, 800);
}

function clearAutoHideTimer() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

function onWindowBlur() {
  startAutoHideTimer();
}

function onWindowFocus() {
  clearAutoHideTimer();
  if (autoHide.value && opacity.value < savedOpacity) {
    opacity.value = savedOpacity;
  }
}

function setupTextResizeObserver() {
  const target = isChord.value ? chordContainerRef.value : intervalsContainerRef.value;
  if (!target || textResizeObserver) return;

  textResizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;

      const baseFontSize = Math.min(width / 8, height / 3, 48);
      const fontSize = Math.max(baseFontSize, 12);
      target.style.fontSize = `${fontSize}px`;
    }
  });

  textResizeObserver.observe(target);
}

onMounted(async () => {
  if (!isTauri()) return;

  const win = getCurrentWindow();
  isMaximized.value = await win.isMaximized();

  const unlistenResized = await win.onResized(async () => {
    isMaximized.value = await win.isMaximized();
  });

  const unlistenBlur = await win.onFocusChanged(({ payload: focused }) => {
    if (!focused) {
      onWindowBlur();
    } else {
      onWindowFocus();
    }
  });

  unlisten.push(unlistenResized, unlistenBlur);

  setupTextResizeObserver();
});

onUnmounted(() => {
  for (const fn of unlisten) {
    fn();
  }
  unlisten = [];
  clearAutoHideTimer();
  if (textResizeObserver) {
    textResizeObserver.disconnect();
    textResizeObserver = null;
  }
});
</script>

<style scoped>
:global(html),
:global(body) {
  background: transparent !important;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.widget-root {
  background-color: oklch(var(--b1) / var(--bg-alpha, 1));
  box-shadow: none;
}

.widget-content {
  opacity: var(--content-alpha, 1);
  transition: opacity 0.15s ease-out;
}

.widget-titlebar {
  background-color: oklch(var(--b1) / var(--bg-alpha, 1));
}

.opacity-slider input[type="range"] {
  height: 8px;
}

.keyboard-container svg {
  width: 100% !important;
  height: 100% !important;
}

.chord-text {
  font-size: clamp(1rem, 8vw, 8rem);
}

.interval-text {
  font-size: clamp(0.75rem, 4vw, 3rem);
}
</style>