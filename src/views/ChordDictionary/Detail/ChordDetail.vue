<template>
  <div ref="detailRef" class="flex flex-col items-center p-4">
    <EmptyChordDetail
      v-if="!chordName || !chord"
      :chord-name="chordName ?? undefined"
    />

    <template v-else>
      <!-- Core: Chord name + toggle -->
      <h1
        class="flex justify-center items-center border-b border-base-200 mb-1 py-2 w-full flex-wrap gap-3"
      >
        <ChordName
          :chord="chord"
          :class="[
            'text-[min(64px,6vw)] flex-grow-0 flex-shrink-0 justify-center font-bold leading-tight',
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
        class="text-center text-[min(24px,4vw)] font-normal leading-tight text-base-content/60 mb-3"
      >
        {{ chord.name }}
      </div>

      <!-- Core: Piano keyboard -->
      <PianoKeyboard
        class="w-full my-4 p-3 sm:p-4 bg-base-200 rounded-lg"
        :targets="midi"
        :played="playedMidiNotes"
        :sustained="sustainedMidiNotes"
        :midi="midiNotes"
        :chord="chord"
        :keyboard="keyboardSettings"
      />

      <!-- Core: Intervals (full width) -->
      <section class="w-full p-3 bg-base-200 rounded-lg mb-4">
        <h3
          class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2 px-1"
        >
          {{ t("chordDictionary.intervals") }}
        </h3>
        <ChordIntervals
          class="text-2xl "
          :intervals="playedIntervals"
          :targets="chord.intervals"
          :pitch-classes="pitchClasses"
          :tonic="chord.tonic"
        />
      </section>

      <!-- Core: Notation (full width) -->
      <section
        class="w-full min-w-0 p-3 bg-base-200 rounded-lg mb-4 overflow-visible"
      >
        <h3
          class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2 px-1"
        >
          {{ t("chordDictionary.notation") }}
        </h3>
        <Notation
          class="mx-auto"
          :midi-notes="midi"
          :key-signature="keySignature"
          :staff-clef="staffClef"
          :staff-transpose="staffTranspose"
          :display="notationDisplay"
        />
      </section>

      <!-- Secondary: Aliases - always visible, compact -->
      <div class="w-full mb-4">
        <details class="collapse collapse-arrow bg-base-200 rounded-lg" open>
          <summary
            class="collapse-title text-sm font-semibold text-base-content/70 uppercase tracking-wide min-h-0 py-2"
          >
            {{ t("chordDictionary.aliases") }}
          </summary>
          <div class="collapse-content pt-0 px-2">
            <ul class="w-full">
              <li
                v-for="(alias, index) in chord.aliases"
                :key="index"
                class="flex items-center justify-between px-3 py-1.5 hover:bg-base-300 rounded-lg text-sm"
                :class="{
                  'border-l-[3px] border-l-warning bg-base-300':
                    isPreferred(index),
                  'border-l-[3px] border-l-info bg-base-200':
                    isDefault(index) && !isPreferred(index),
                }"
              >
                <div class="flex items-center gap-2">
                  <span
                    v-if="isPreferred(index)"
                    class="badge badge-warning badge-xs mr-1"
                  >
                    {{ t("chordDictionary.preferredNotation") }}
                  </span>
                  <span
                    v-else-if="isDefault(index)"
                    class="badge badge-info badge-xs mr-1"
                  >
                    {{ t("chordDictionary.defaultNotation") }}
                  </span>
                  <span
                    v-else-if="index < notationLabels.length"
                    class="badge badge-ghost badge-xs mr-1"
                  >
                    {{ notationLabels[index] }}
                  </span>
                  <ChordName :chord="chord" :notation="index" />
                </div>
                <button
                  class="btn btn-sm btn-ghost btn-circle tooltip tooltip-bottom"
                  :class="
                    isPreferred(index) || isDefault(index) ? 'text-warning' : ''
                  "
                  :data-tip="
                    isPreferred(index)
                      ? t('chordDictionary.unsetAsPreferredAlias', { alias })
                      : t('chordDictionary.setAsPreferredAlias', { alias })
                  "
                  :aria-label="
                    isPreferred(index)
                      ? t('chordDictionary.unsetAsPreferredAlias', { alias })
                      : t('chordDictionary.setAsPreferredAlias', { alias })
                  "
                  @click="toggleAlias(isPreferred(index), chord.aliases[index])"
                >
                  <Icon
                    name="star"
                    size="14"
                    :class="
                      isPreferred(index) || isDefault(index)
                        ? 'fill-current'
                        : ''
                    "
                  />
                </button>
              </li>
            </ul>
          </div>
        </details>
      </div>

      <!-- Tertiary: Other interpretations - collapsed by default -->
      <div v-if="alternativeChords.length" class="w-full mb-4">
        <details class="collapse collapse-arrow bg-base-200 rounded-lg">
          <summary
            class="collapse-title text-sm font-semibold text-base-content/70 uppercase tracking-wide min-h-0 py-2"
          >
            {{ t("chordDictionary.otherInterpretations") }}
          </summary>
          <div class="collapse-content pt-0 px-2">
            <ul class="w-full">
              <li
                v-for="altChord in alternativeChords"
                :key="altChord.symbol"
                class="px-3 py-1.5 hover:bg-base-300 rounded-lg cursor-pointer text-sm"
                @click="goToChordDetail(altChord.tonic + altChord.aliases[0])"
              >
                <ChordName :chord="altChord" />
              </li>
            </ul>
          </div>
        </details>
      </div>

      <!-- Tertiary: Inversions - collapsed by default -->
      <div class="w-full mb-4">
        <details class="collapse collapse-arrow bg-base-200 rounded-lg">
          <summary
            class="collapse-title text-sm font-semibold text-base-content/70 uppercase tracking-wide min-h-0 py-2"
          >
            {{ t("chordDictionary.inversions") }}
          </summary>
          <div class="collapse-content pt-0 px-2">
            <template v-for="(_, index) in chord.intervals" :key="index">
              <div
                v-if="index > 0"
                class="flex flex-row items-center flex-wrap w-full gap-3 p-3 mb-2 bg-base-200 rounded-lg"
              >
                <div class="flex-basis-[200px] flex-grow-0">
                  <ChordName
                    :chord="getSlashChord(index)"
                    class="text-2xl font-semibold"
                  />
                  <div class="text-xs italic text-base-content/70">
                    {{
                      t("chordDictionary.inversionOn", {
                        interval: getInterval(index),
                      })
                    }}
                  </div>
                  <div v-if="getAltChord(index)" class="text-xs mt-2">
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
                  class="flex-grow"
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

      <!-- Exploratory: Simplified & Extended - collapsed, grouped -->
      <div
        v-if="subsetChords.length || supersetChords.length"
        class="w-full mb-4"
      >
        <details class="collapse collapse-arrow bg-base-200 rounded-lg">
          <summary
            class="collapse-title text-sm font-semibold text-base-content/70 uppercase tracking-wide min-h-0 py-2"
          >
            {{ t("chordDictionary.simplified") }} /
            {{ t("chordDictionary.extended") }}
          </summary>
          <div class="collapse-content pt-0 px-2 space-y-3">
            <div v-if="subsetChords.length">
              <h4
                class="text-xs font-medium text-base-content/60 uppercase tracking-wide mb-1.5"
              >
                {{ t("chordDictionary.simplified") }}
              </h4>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="(c, index) in subsetChords"
                  :key="index"
                  class="btn btn-sm btn-primary rounded-full"
                  @click="goToChordDetail(c.tonic + c.aliases[0])"
                >
                  <ChordName :chord="c" />
                </button>
              </div>
            </div>
            <div v-if="supersetChords.length">
              <h4
                class="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-1.5"
              >
                {{ t("chordDictionary.extended") }}
              </h4>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="(c, index) in supersetChords"
                  :key="index"
                  class="btn btn-sm btn-primary rounded-full"
                  @click="goToChordDetail(c.tonic + c.aliases[0])"
                >
                  <ChordName :chord="c" />
                </button>
              </div>
            </div>
          </div>
        </details>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Chord, Note } from "tonal";
import type { Chord as TChord } from "@tonaljs/chord";

import { useSettingsStore } from "@/stores/settings";
import { useChordDictionaryStore } from "@/stores/chordDictionary";
import { useChordDictionaryModule } from "../ChordDictionaryModuleProvider";
import {
  getChordInversion,
  getAlternativeChords,
  getSubsetChords,
  getSupersetChords,
} from "./utils";
import { getChordDegrees, getNoteInKeySignature } from "@/helpers";
import Icon from "@/components/Icon/Icon.vue";
import ChordName from "@/components/ChordName/ChordName.vue";
import ChordIntervals from "@/components/ChordIntervals/ChordIntervals.vue";
import Notation from "@/components/Notation/Notation.vue";
import PianoKeyboard from "@/components/PianoKeyboard/PianoKeyboard.vue";
import EmptyChordDetail from "./EmptyChordDetail.vue";

const KEYBOARD_SETTINGS = {
  skin: "classic",
  from: "C3",
  to: "B5",
  label: "chordNote",
  keyName: "none",
  keyInfo: "tonicAndInterval",
  textOpacity: 1,
  displaySustained: true,
  wrap: true,
  fadeOutDuration: 0,
  sizes: {
    radius: 0.4,
    height: 4,
    ratio: 0.6,
    bevel: true,
  },
  colors: {
    white: null,
    black: null,
    played: null,
    wrapped: null,
    sustained: null,
  },
} as const;

const NOTATION_LABELS = ["long", "short", "symbol"];

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const chordDictionaryStore = useChordDictionaryStore();

const {
  keySignature,
  midiNotes,
  playedMidiNotes,
  sustainedMidiNotes,
  pitchClasses,
  disableUpdate,
} = useChordDictionaryModule();

const detailRef = ref<HTMLElement | null>(null);

const chordName = computed(() => route.params.chordName as string | undefined);

const chord = computed(() =>
  chordName.value ? Chord.get(chordName.value) : null,
);

const isDisabled = computed(
  () =>
    !!(
      chord.value &&
      settingsStore.settings.chordDictionary.disabled.includes(
        chord.value.aliases[0],
      )
    ),
);

const staffClef = computed(() => settingsStore.settings.notation.staffClef);
const staffTranspose = computed(
  () => settingsStore.settings.notation.staffTranspose,
);
const notationDisplay = computed(() => settingsStore.settings.notation.display);

const midi = computed(() => getChordInversion(chord.value!, 0));

const alternativeChords = computed(() =>
  getAlternativeChords(
    chord.value!,
    keySignature,
    settingsStore.settings.chordDictionary.disabled,
    settingsStore.settings.chordDictionary.hideDisabled,
  ),
);

const subsetChords = computed(() =>
  getSubsetChords(
    chord.value!,
    settingsStore.settings.chordDictionary.disabled,
    settingsStore.settings.chordDictionary.hideDisabled,
  ),
);

const supersetChords = computed(() =>
  getSupersetChords(
    chord.value!,
    keySignature,
    settingsStore.settings.chordDictionary.filterInKey,
    settingsStore.settings.chordDictionary.disabled,
    settingsStore.settings.chordDictionary.hideDisabled,
  ),
);

const playedIntervals = computed(() =>
  getChordDegrees(chord.value!, pitchClasses),
);

const keyboardSettings = computed(() => KEYBOARD_SETTINGS);

const notationLabels = computed(() => NOTATION_LABELS);

watch(chordName, async () => {
  await nextTick();
  if (detailRef.value) {
    detailRef.value.scrollIntoView({ behavior: "smooth" });
  }
});

function goToChordDetail(name: string) {
  router.push({ path: `/chord-dictionary/${encodeURIComponent(name)}` });
}

function toggleDisabled(isEnabled: boolean | null) {
  if (isEnabled === null || !chord.value) return;
  const disabled = isEnabled
    ? settingsStore.settings.chordDictionary.disabled.filter(
        (c) => c !== chord.value!.aliases[0],
      )
    : [
        ...settingsStore.settings.chordDictionary.disabled,
        chord.value!.aliases[0],
      ];

  settingsStore.updateSetting("chordDictionary.disabled", disabled);
}

function toggleAlias(isPreferred: boolean, alias: string) {
  if (!chord.value) return;

  if (isPreferred) {
    chordDictionaryStore.removePreferredAlias(chord.value.aliases[0]);
  } else {
    chordDictionaryStore.setPreferredAlias(chord.value.aliases[0], alias);
  }
}

function isPreferred(index: number): boolean {
  if (!chord.value) return false;
  return chordDictionaryStore.isPreferredAlias(
    chord.value.aliases[0],
    chord.value.aliases[index],
  );
}

function isDefault(index: number): boolean {
  if (!chord.value) return false;
  return chordDictionaryStore.isDefaultAlias(chord.value.aliases[0], index);
}

function getSlashChord(index: number): TChord {
  const root = chord.value!.notes[index];
  return { ...chord.value!, root, rootDegree: index };
}

function getInterval(index: number): string {
  return chord.value!.intervals[index].replace("*", "");
}

function getInversionMidi(index: number): number[] {
  return getChordInversion(chord.value!, index);
}

function getAltChord(index: number) {
  const root = chord.value!.notes[index];
  return alternativeChords.value.find(
    (c) => c.tonic && Note.chroma(c.tonic) === Note.chroma(root),
  );
}

function getAltChordName(index: number): string {
  const altChord = getAltChord(index);
  if (altChord && altChord.tonic) {
    return (
      getNoteInKeySignature(altChord.tonic, keySignature.notes) +
      altChord.aliases[0]
    );
  }
  return "";
}
</script>
