<template>
  <div
    id="chordDisplay"
    class="relative w-full h-full flex flex-col bg-gradient-to-b from-base-200 to-base-100"
  >
    <div
      id="container"
      class="flex flex-col lg:flex-row flex-1 items-center justify-center w-full gap-3 sm:gap-4 lg:gap-6 p-3 sm:p-4 lg:p-6"
    >
      <!-- 乐谱显示区域 -->
      <Notation
        v-if="displayNotation"
        id="notation"
        class="flex-shrink-0"
        :midiNotes="midiNotes as number[]"
        :keySignature="keySignature"
        :staffClef="staffClef"
        :staffTranspose="staffTranspose"
      />

      <!-- 和弦信息展示区域 -->
      <div
        id="display"
        class="relative z-10 flex flex-col flex-1 flex-shrink-0 items-center justify-center"
      >
        <!-- 和弦名称 -->
        <div
          v-if="displayChord"
          id="chord"
          class="flex flex-col flex-grow-0 flex-shrink-0 items-center justify-center"
          style="letter-spacing: 0.02em"
        >
          <ChordNameLink
            :chord="chords[0] as any"
            :notation="chordNotation"
            :highlightAlterations="highlightAlterations"
          />
        </div>

        <!-- 和弦详细名称 -->
        <div
          v-if="displayName"
          id="name"
          class="text-xs sm:text-sm md:text-base min-h-[2vh] px-3 sm:px-4 text-center font-medium opacity-90 leading-tight
            max-w-full lg:max-w-lg"
        >
          {{ chords[0]?.name }}
        </div>

        <!-- 音程显示 -->
        <div
          v-if="displayIntervals"
          id="intervals"
          class="font-medium transition-all tracking-wider sm:tracking-widest
            text-xs sm:text-sm md:text-base lg:text-lg"
          style="font-size: clamp(0.75rem, 1.5vh, 1.25rem)"
        >
          <ChordIntervals
            :intervals="chords[0]?.intervals as unknown as string[]"
            :pitchClasses="pitchClasses as unknown as string[]"
            :tonic="chords[0]?.tonic"
          />
        </div>

        <!-- 替代和弦 -->
        <div
          v-if="displayAltChords"
          id="alternativeChords"
          class="absolute z-20 flex flex-col gap-1
            top-1 right-1 sm:top-2 sm:right-2 lg:top-0 lg:right-0
            p-1.5 sm:p-2 lg:p-2
            text-xl sm:text-2xl md:text-3xl lg:text-4xl"
          style="text-shadow: 0 0.05em 0.1em rgba(0, 0, 0, 0.6)"
        >
          <template v-for="(chord, index) in chords" :key="index">
            <ChordNameLink
              v-if="index > 0"
              :chord="chord as any"
              :notation="chordNotation"
              :highlightAlterations="highlightAlterations"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- 钢琴键盘区域 -->
    <div v-if="displayKeyboard" class="flex-shrink-0 w-full px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6">
      <PianoKeyboard
        id="keyboard"
        class="w-full rounded-lg shadow-lg lg:shadow-xl transition-all duration-300
          h-[20%] sm:h-[25%] lg:h-auto
          lg:max-h-[35%] xl:max-h-[40%]
          min-h-[70px] sm:min-h-[80px] lg:min-h-[100px]"
        :sustained="sustainedMidiNotes as unknown as number[]"
        :played="playedMidiNotes as unknown as number[]"
        :midi="midiNotes as unknown as number[]"
        :chord="chords[0] as any"
        :keySignature="keySignature as unknown as KeySignatureConfig"
        :keyboard="keyboard"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PianoKeyboard } from "@/components/PianoKeyboard/";
import { Notation } from "@/components/Notation/";
import { ChordNameLink } from "@/components/ChordNameLink/";
import { ChordIntervals } from "@/components/ChordIntervals/";
import { useNotes } from "@/composables/";
import { useSettingsStore } from "@/stores";
import type { StaffClef } from "@/components/Notation/types";
import type { KeySignatureConfig } from "@/helpers";

const props = defineProps<{
  moduleId: string;
}>();

const settingsStore = useSettingsStore();

const moduleSettings = computed(() => {
  return settingsStore.settings.chordDisplay.find(
    (m) => m.id === props.moduleId,
  );
});

const accidentals = computed(() => settingsStore.settings.notation.accidentals);
const key = computed(() => settingsStore.settings.notation.key);
const staffClef = computed<StaffClef>(
  () => settingsStore.settings.notation.staffClef,
);
const staffTranspose = computed(
  () => settingsStore.settings.notation.staffTranspose,
);

const {
  midiNotes,
  pitchClasses,
  sustainedMidiNotes,
  playedMidiNotes,
  chords,
  keySignature,
} = useNotes({
  accidentals: accidentals.value,
  key: key.value,
  midiChannel: 0,
  allowOmissions: moduleSettings.value?.allowOmissions ?? false,
  useSustain: moduleSettings.value?.useSustain ?? true,
  detectOnRelease: moduleSettings.value?.detectOnRelease ?? true,
  disabledChords: settingsStore.settings.chordDictionary.disabled,
});

const chordNotation = computed(
  () => moduleSettings.value?.chordNotation ?? "preferred",
);
const highlightAlterations = computed(
  () => moduleSettings.value?.highlightAlterations ?? false,
);
const displayKeyboard = computed(
  () => moduleSettings.value?.displayKeyboard ?? true,
);
const displayChord = computed(() => moduleSettings.value?.displayChord ?? true);
const displayName = computed(() => moduleSettings.value?.displayName ?? false);
const displayNotation = computed(
  () => moduleSettings.value?.displayNotation ?? false,
);
const displayAltChords = computed(
  () => moduleSettings.value?.displayAltChords ?? true,
);
const displayIntervals = computed(
  () => moduleSettings.value?.displayIntervals ?? false,
);
const keyboard = computed(() => moduleSettings.value?.keyboard);
</script>
