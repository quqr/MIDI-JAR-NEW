<template>
  <div v-if="question" class="w-full flex flex-col items-center gap-3">
    <!-- 展示区：按 mode 与 displayMode 计算是否渲染视觉提示 -->
    <div
      v-if="showNotation || showKeyboard"
      class="w-full bg-base-200/60 rounded-2xl px-3 py-3 space-y-3"
    >
      <div v-if="showNotation" class="w-full flex items-center justify-center">
        <Notation
          class="w-full max-w-lg"
          :midi-notes="question.visualMidi"
          :key-signature="question.keySignature"
          :staff-clef="staffClef"
          :staff-transpose="staffTranspose"
          :display="notationDisplay"
          :layout="notationLayout"
          :style="notationStyle"
        />
      </div>

      <div v-if="showKeyboard" class="w-full h-40 overflow-hidden">
        <PianoKeyboard
          id="quiz-keyboard"
          :keyboard="keyboard"
          :midi="question.visualMidi"
          :chord="{ notes: question.chordNotes }"
          :clickable="false"
          :sustain-mode="false"
        />
      </div>
    </div>

    <!-- 播放控制：aural 模式为主要交互，其余模式为辅助收听 -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="btn btn-primary rounded-full px-6"
        :disabled="!canPlay"
        @click="handlePlay"
      >
        <svg
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <polygon points="6 3 20 12 6 21 6 3" />
        </svg>
        <span>{{ isAural ? $t("quiz.play") : $t("quiz.replay") }}</span>
      </button>
      <p v-if="!canPlay" class="text-sm text-base-content/60" role="status">
        {{ $t("quiz.soundUnavailable") }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// 题目展示区：按模式渲染五线谱 / 钢琴 / 播放按钮
import { computed } from "vue";
import { Notation } from "@/components/Notation/";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import { useSettingsStore } from "@/stores";
import {
  mergeDisplayConfig,
  mergeLayoutConfig,
  mergeStyleConfig,
} from "@/components/Notation/utils";
import { createKeyboardSettingsFromPiano } from "@/utils/pianoUtils";
import type { DisplayMode, KeyboardRange, QuizQuestion } from "@/types";

const props = withDefaults(
  defineProps<{
    question: QuizQuestion;
    displayMode: DisplayMode;
    /** 键盘显示音域档位（控制琴键数量，答题中可实时调整） */
    keyboardRange: KeyboardRange;
    soundEnabled: boolean;
    soundReady: boolean;
  }>(),
  {
    displayMode: "auto",
    keyboardRange: "medium",
    soundEnabled: true,
    soundReady: false,
  },
);

const emit = defineEmits<{
  play: [];
}>();

const settingsStore = useSettingsStore();

const isAural = computed(() => props.question.mode === "aural");
const canPlay = computed(() => props.soundEnabled && props.soundReady);

/** 听觉模式恒不渲染任何视觉提示；auto 对非听觉模式等效于 both */
const effectiveDisplay = computed<"keyboard" | "notation" | "both" | "none">(
  () => {
    if (isAural.value) return "none";
    if (props.displayMode === "auto" || props.displayMode === "both")
      return "both";
    return props.displayMode;
  },
);

const showNotation = computed(
  () =>
    effectiveDisplay.value === "notation" || effectiveDisplay.value === "both",
);
const showKeyboard = computed(
  () =>
    effectiveDisplay.value === "keyboard" || effectiveDisplay.value === "both",
);

const staffClef = computed(() => settingsStore.settings.notation.staffClef);
const staffTranspose = computed(
  () => settingsStore.settings.notation.staffTranspose,
);
const notationDisplay = computed(() =>
  mergeDisplayConfig(settingsStore.settings.notation.display),
);
const notationLayout = computed(() =>
  mergeLayoutConfig(settingsStore.settings.notation.layout),
);
const notationStyle = computed(() =>
  mergeStyleConfig(settingsStore.settings.notation.style),
);

/** 键盘音域档位 → 起止音（琴键数量：窄 13 / 中 25 / 宽 29） */
const KEYBOARD_RANGES: Record<KeyboardRange, { from: string; to: string }> = {
  narrow: { from: "C4", to: "C5" },
  medium: { from: "C3", to: "C5" },
  wide: { from: "C3", to: "B5" },
};

const keyboard = computed(
  () =>
    ({
      ...createKeyboardSettingsFromPiano(settingsStore.settings.piano),
      ...KEYBOARD_RANGES[props.keyboardRange],
    }) as ReturnType<typeof createKeyboardSettingsFromPiano>,
);

function handlePlay() {
  emit("play");
}
</script>
