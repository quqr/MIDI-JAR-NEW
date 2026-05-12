<template>
  <div
    class="h-full w-full flex flex-col text-base-content overflow-hidden"
    :style="{ backgroundColor: bgColorWithAlpha }"
  >
    <WidgetTitleBar
      :title="widgetTitle"
      :type="type"
      :isMaximized="isMaximized"
      :alwaysOnTop="alwaysOnTop"
      :autoHide="autoHide"
      :positionLocked="positionLocked"
      :opacity="opacity"
      @close="handleClose"
      @minimize="handleMinimize"
      @toggleMaximize="handleToggleMaximize"
      @toggleAlwaysOnTop="handleToggleAlwaysOnTop"
      @toggleAutoHide="handleToggleAutoHide"
      @toggleLock="handleToggleLock"
      @changeOpacity="handleChangeOpacity"
    />
    <div class="flex-1 min-h-0 overflow-hidden">
      <div v-if="isKeyboard" class="h-full w-full p-1">
        <PianoKeyboard
          :sustained="sustainedMidiNotes as unknown as number[]"
          :played="playedMidiNotes as unknown as number[]"
          :midi="midiNotes as unknown as number[]"
          :chord="chords[0] as any"
          :keySignature="keySignature as unknown as KeySignatureConfig"
          :keyboard="keyboardSettings"
        />
      </div>
      <div v-else-if="isNotation" class="h-full w-full flex items-center justify-center p-1">
        <Notation
          class="max-w-full max-h-full"
          :midiNotes="midiNotes as number[]"
          :keySignature="keySignature"
          :staffClef="staffClef"
          :staffTranspose="staffTranspose"
          :display="notationDisplay"
          :layout="notationLayout"
          :style="notationStyle"
        />
      </div>
      <div v-else-if="isChord" class="h-full w-full flex flex-col items-center justify-center p-2">
        <div class="w-full flex items-center justify-center text-2xl sm:text-4xl font-bold">
          <ChordNameLink :chord="chords[0] as any" :notation="chordNotation" :highlightAlterations="highlightAlterations" />
        </div>
        <div class="w-full text-center text-sm sm:text-lg font-semibold opacity-70 mt-2">
          {{ chords[0]?.name }}
        </div>
      </div>
      <div v-else-if="isIntervals" class="h-full w-full flex items-center justify-center p-2">
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
import type { KeySignatureConfig } from "@/types";

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

const isMaximized = ref(false);
const alwaysOnTop = ref(true);
const autoHide = ref(false);
const positionLocked = ref(false);
const opacity = ref(1);
let unlisten: (() => void)[] = [];
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
let savedOpacity = 1;

const bgColorWithAlpha = computed(() => {
  const alpha = opacity.value;
  return `oklch(var(--b1) / ${alpha})`;
});

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
  useSustain: computed(() => moduleSettings.value?.useSustain ?? true),
  detectOnRelease: computed(() => moduleSettings.value?.detectOnRelease ?? true),
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
  positionLocked.value = !positionLocked.value;
  if (isTauri()) {
    const win = getCurrentWindow();
    await win.setResizable(!positionLocked.value);
  }
}

async function handleChangeOpacity(value: number) {
  opacity.value = value;
  savedOpacity = value;
}

function startAutoHideTimer() {
  if (!autoHide.value) return;
  clearAutoHideTimer();
  autoHideTimer = setTimeout(() => {
    savedOpacity = opacity.value;
    opacity.value = 0.1;
  }, 1000);
}

function clearAutoHideTimer() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

async function onWindowBlur() {
  startAutoHideTimer();
}

function onWindowFocus() {
  clearAutoHideTimer();
  if (autoHide.value && opacity.value < savedOpacity) {
    opacity.value = savedOpacity;
  }
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
});

onUnmounted(() => {
  for (const fn of unlisten) {
    fn();
  }
  unlisten = [];
  clearAutoHideTimer();
});
</script>
