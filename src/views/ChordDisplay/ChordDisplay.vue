<template>
  <div
    id="chordDisplay"
    class="max-w-full h-full flex flex-col gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4"
  >
    <div
      class="flex flex-col bg-primary rounded-lg p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3 md:space-y-4"
    >
      <!-- 乐谱显示区域 -->
      <div
        v-if="displayNotation"
        class="w-full min-h-[180px] sm:min-h-[200px] md:min-h-[220px]"
      >
        <Notation
          id="notation"
          class="w-full items-center"
          :midiNotes="midiNotes as number[]"
          :keySignature="keySignature"
          :staffClef="staffClef"
          :staffTranspose="staffTranspose"
        />
      </div>

      <!-- 和弦信息展示区域 -->
      <div class="card bg-base-100 shadow-sm p-2 sm:p-3 md:p-4">
        <!-- 和弦名称 -->
        <div
          v-if="displayChord"
          id="chord"
          class="text-base sm:text-lg md:text-xl font-semibold"
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
          class="text-sm sm:text-base text-base-content/70 mt-1 sm:mt-2"
        >
          {{ chords[0]?.name }}
        </div>

        <!-- 音程显示 -->
        <div v-if="displayIntervals" id="intervals" class="mt-2 sm:mt-3">
          <ChordIntervals
            :intervals="chords[0]?.intervals as unknown as string[]"
            :pitchClasses="pitchClasses as unknown as string[]"
            :tonic="chords[0]?.tonic"
          />
        </div>

        <!-- 替代和弦 -->
        <div
          v-if="displayAltChords"
          class="flex flex-wrap gap-1 sm:gap-2 mt-2 sm:mt-3"
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
    <div
      v-if="displayKeyboard"
      class="flex bg-secondary rounded-lg p-2 sm:p-3 md:p-4 flex-shrink-0"
    >
      <PianoKeyboard
        id="keyboard"
        class="w-full h-full"
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
import { useMidiRoutingStore } from "@/stores/midiRouting";
import type { StaffClef } from "@/components/Notation/types";
import type { KeySignatureConfig } from "@/helpers";

const props = defineProps<{
  moduleId: string;
}>();

const settingsStore = useSettingsStore();
const routingStore = useMidiRoutingStore();
routingStore.addChordDisplayOutput(props.moduleId);

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
  namespace: `chord-display/${props.moduleId}`,
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
