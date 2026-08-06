<template>
  <div v-if="chord" class="w-full mb-4">
    <details class="collapse collapse-arrow bg-base-200 rounded-hig-lg">
      <summary
        class="collapse-title text-hig-xs font-semibold text-base-content/70 uppercase tracking-wide min-h-0 py-2"
      >
        {{ t("chordDictionary.inversions") }}
      </summary>
      <div class="collapse-content pt-0 px-2">
        <template v-for="(_, index) in chord.intervals" :key="index">
          <div
            v-if="index > 0"
            class="flex flex-row items-center flex-wrap w-full gap-3 p-3 mb-2 bg-base-200 rounded-hig-lg"
          >
            <div class="flex-basis-[200px] flex-grow-0">
              <ChordName
                :chord="getSlashChord(index)"
                class="text-hig-2xl font-semibold"
              />
              <div class="text-hig-xs italic text-base-content/70">
                {{
                  t("chordDictionary.inversionOn", {
                    interval: getInterval(index),
                  })
                }}
              </div>
              <div v-if="getAltChord(index)" class="text-hig-xs mt-2">
                {{ t("chordDictionary.seeAlso") }}
                <a
                  href="#"
                  class="text-primary hover:underline"
                  @click.prevent="
                    goToChordDetail(
                      getAltChord(index)!.tonic +
                        getAltChord(index)!.aliases[0],
                    )
                  "
                >
                  {{ getAltChordName(index) }}
                </a>
              </div>
            </div>
            <PianoKeyboard
              class="flex-grow min-h-[140px]"
              :played="getInversionMidi(index)"
              :midi="getInversionMidi(index)"
              :chord="getSlashChord(index)"
              :keyboard="keyboardSettings"
            />
            <Notation
              class="mx-auto"
              :midi-notes="getInversionMidi(index)"
              :key-signature="keySignature"
              :staff-clef="staffClef"
              :staff-transpose="staffTranspose"
              :display="notationDisplay"
            />
          </div>
        </template>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import ChordName from "@/components/ChordName/ChordName.vue";
import { PianoKeyboard } from "@/components/PianoKeyboard";
import Notation from "@/components/Notation/Notation.vue";
import { useChordDetailContext } from "../composables/useChordDetail";

const {
  t,
  chord,
  keySignature,
  staffClef,
  staffTranspose,
  notationDisplay,
  keyboardSettings,
  goToChordDetail,
  getSlashChord,
  getInterval,
  getInversionMidi,
  getAltChord,
  getAltChordName,
} = useChordDetailContext();
</script>
