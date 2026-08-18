<template>
  <div ref="detailRef" class="flex flex-col items-center p-4">
    <EmptyChordDetail
      v-if="!chordName || !chord"
      :chord-name="chordName ?? undefined"
    />

    <div v-else :key="chordName" class="flex flex-col items-center w-full">
      <!-- Core: Chord name + toggle -->
      <h1
        class="flex justify-center items-center border-b border-base-200 mb-1 py-2 w-full flex-wrap gap-3"
      >
        <ChordName
          :chord="chord"
          :class="[
            'text-4xl flex-grow-0 flex-shrink-0 justify-center font-bold leading-tight',
            { 'opacity-50': isDisabled },
          ]"
        />
        <label
          v-if="!disableUpdate"
          class="flex items-center gap-2 cursor-pointer text-sm"
        >
          <input
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            :checked="!isDisabled"
            @change="toggleDisabled(!isDisabled)"
          />
          {{ t("chordDictionary.disableEnableChord") }}
        </label>
      </h1>

      <div
        class="text-center text-lg font-normal leading-tight text-base-content/70 mb-3"
      >
        {{ chord.name }}
      </div>

      <!-- 和弦播放控制 -->
      <div class="flex items-center gap-3 mb-3">
        <!-- 声音开关 -->
        <label class="flex items-center gap-1.5 cursor-pointer text-sm">
          <input
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            v-model="soundEnabled"
          />
          <Icon name="speaker" :size="14" aria-hidden="true" />
        </label>

        <!-- 播放模式切换 -->
        <div class="join">
          <button
            class="btn btn-xs join-item"
            :class="chordPlayMode === 'block' ? 'btn-primary' : 'btn-outline'"
            :aria-pressed="chordPlayMode === 'block'"
            @click="chordPlayMode = 'block'"
          >
            {{ t("sampler.blockChord") }}
          </button>
          <button
            class="btn btn-xs join-item"
            :class="
              chordPlayMode === 'arpeggiated' ? 'btn-primary' : 'btn-outline'
            "
            :aria-pressed="chordPlayMode === 'arpeggiated'"
            @click="chordPlayMode = 'arpeggiated'"
          >
            {{ t("sampler.arpeggiatedChord") }}
          </button>
        </div>

        <!-- 播放/停止按钮 -->
        <button
          class="btn btn-sm btn-circle"
          :class="isPlayingChord ? 'btn-error' : 'btn-primary'"
          :disabled="!soundEnabled"
          @click="isPlayingChord ? stopChord() : playChord()"
        >
          <Icon
            :name="isPlayingChord ? 'stop' : 'play'"
            :size="14"
            aria-hidden="true"
          />
        </button>
      </div>

      <!-- Core: Piano keyboard -->
      <PianoKeyboard
        class="w-full my-4 p-3 sm:p-4 bg-base-200 rounded-xl border border-base-300"
        style="height: 140px"
        :targets="midi"
        :played="playedMidiNotes"
        :sustained="sustainedMidiNotes"
        :midi="midiNotes"
        :chord="chord"
        :keyboard="keyboardSettings"
      />

      <!-- Core: Intervals -->
      <ChordIntervalsTable />

      <!-- Core: Notation -->
      <ChordNotesDisplay />

      <!-- Secondary: Aliases -->
      <ChordAliases />

      <!-- Tertiary: Other interpretations -->
      <ChordAlternatives />

      <!-- Tertiary: Inversions -->
      <ChordInversions />

      <!-- Exploratory: Simplified & Extended -->
      <ChordRelated />
    </div>
  </div>
</template>

<script setup lang="ts">
import ChordName from "@/components/ChordName/ChordName.vue";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import Icon from "@/components/Icon/Icon.vue";
import EmptyChordDetail from "./EmptyChordDetail.vue";
import ChordIntervalsTable from "./components/ChordIntervalsTable.vue";
import ChordNotesDisplay from "./components/ChordNotesDisplay.vue";
import ChordAliases from "./components/ChordAliases.vue";
import ChordAlternatives from "./components/ChordAlternatives.vue";
import ChordInversions from "./components/ChordInversions.vue";
import ChordRelated from "./components/ChordRelated.vue";
import { useChordDetail } from "./composables/useChordDetail";

const {
  detailRef,
  chordName,
  chord,
  isDisabled,
  disableUpdate,
  t,
  midi,
  midiNotes,
  playedMidiNotes,
  sustainedMidiNotes,
  keyboardSettings,
  toggleDisabled,
  chordPlayMode,
  isPlayingChord,
  playChord,
  stopChord,
  soundEnabled,
} = useChordDetail();

defineExpose({ detailRef });
</script>
