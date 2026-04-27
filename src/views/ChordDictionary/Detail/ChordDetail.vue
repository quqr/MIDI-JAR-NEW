<template>
  <div
    ref="detailRef"
    class="flex flex-col items-center p-4 max-w-[1200px] mx-auto"
  >
    <EmptyChordDetail
      v-if="!chordName || !chord"
      :chord-name="chordName ?? undefined"
    />

    <template v-else>
      <h1
        class="flex justify-center items-center border-b-2 border-base-content/12 mb-2 py-2 w-full flex-wrap gap-3"
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
        class="text-center text-[min(24px,4vw)] font-normal leading-tight text-base-content/80"
      >
        {{ chord.name }}
      </div>

      <PianoKeyboard
        class="w-full my-6 p-4 bg-base-200/50 rounded-lg"
        :targets="midi"
        :played="playedMidiNotes"
        :sustained="sustainedMidiNotes"
        :midi="midiNotes"
        :chord="chord"
        :keyboard="keyboardSettings"
      />

      <div class="flex flex-row flex-wrap gap-6 w-full mb-4">
        <section
          class="flex-basis-[320px] flex-grow min-w-[280px] p-4 bg-base-200/50 rounded-lg"
        >
          <details class="collapse collapse-arrow bg-base-200/30" open>
            <summary
              class="collapse-title text-base font-semibold text-base-content/80 uppercase tracking-wide"
            >
              {{ t("chordDictionary.intervals") }}
            </summary>
            <div class="collapse-content pt-0">
              <ChordIntervals
                class="text-2xl"
                :intervals="playedIntervals"
                :targets="chord.intervals"
                :pitch-classes="pitchClasses"
                :tonic="chord.tonic"
              />
            </div>
          </details>
        </section>

        <section
          class="flex-basis-[320px] flex-grow min-w-[280px] p-4 bg-base-200/50 rounded-lg"
        >
          <details class="collapse collapse-arrow bg-base-200/30" open>
            <summary
              class="collapse-title text-base font-semibold text-base-content/80 uppercase tracking-wide"
            >
              {{ t("chordDictionary.notation") }}
            </summary>
            <div class="collapse-content pt-0">
              <Notation
                class="mx-auto"
                :midi-notes="midi"
                :key-signature="keySignature"
                :staff-clef="staffClef"
                :staff-transpose="staffTranspose"
              />
            </div>
          </details>
        </section>
      </div>

      <div class="flex flex-row flex-wrap gap-6 w-full mb-4">
        <section
          class="flex-basis-[320px] flex-grow min-w-[280px] p-4 bg-base-200/50 rounded-lg"
        >
          <details class="collapse collapse-arrow bg-base-200/30" open>
            <summary
              class="collapse-title text-base font-semibold text-base-content/80 uppercase tracking-wide"
            >
              {{ t("chordDictionary.aliases") }}
            </summary>
            <div class="collapse-content pt-0">
              <ul class="w-full">
                <li
                  v-for="(alias, index) in chord.aliases"
                  :key="index"
                  class="flex items-center justify-between px-3 py-2 hover:bg-base-200 rounded-md"
                  :class="{
                    'border-l-[3px] border-l-warning bg-base-200':
                      isPreferred(index),
                    'border-l-[3px] border-l-info bg-base-200/50':
                      isDefault(index) && !isPreferred(index),
                  }"
                >
                  <div class="flex items-center gap-2">
                    <span
                      v-if="isPreferred(index)"
                      class="badge badge-warning badge-sm mr-2"
                    >
                      {{ t("chordDictionary.preferredNotation") }}
                    </span>
                    <span
                      v-else-if="isDefault(index)"
                      class="badge badge-info badge-sm mr-2"
                    >
                      {{ t("chordDictionary.defaultNotation") }}
                    </span>
                    <span
                      v-else-if="index < notationLabels.length"
                      class="badge badge-ghost badge-sm mr-2"
                    >
                      {{ notationLabels[index] }}
                    </span>
                    <ChordName :chord="chord" :notation="index" />
                  </div>
                  <button
                    class="btn btn-sm btn-ghost btn-circle"
                    :class="
                      isPreferred(index) || isDefault(index)
                        ? 'text-warning'
                        : ''
                    "
                    :title="
                      isPreferred(index)
                        ? t('chordDictionary.unsetAsPreferredAlias', { alias })
                        : t('chordDictionary.setAsPreferredAlias', { alias })
                    "
                    :aria-label="
                      isPreferred(index)
                        ? t('chordDictionary.unsetAsPreferredAlias', { alias })
                        : t('chordDictionary.setAsPreferredAlias', { alias })
                    "
                    @click="
                      toggleAlias(isPreferred(index), chord.aliases[index])
                    "
                  >
                    <Icon
                      :name="
                        isPreferred(index) || isDefault(index) ? 'star' : 'star'
                      "
                      size="16"
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
        </section>

        <section
          v-if="alternativeChords.length"
          class="flex-basis-[320px] flex-grow min-w-[280px] p-4 bg-base-200/50 rounded-lg"
        >
          <details class="collapse collapse-arrow bg-base-200/30">
            <summary
              class="collapse-title text-base font-semibold text-base-content/80 uppercase tracking-wide"
            >
              {{ t("chordDictionary.otherInterpretations") }}
            </summary>
            <div class="collapse-content pt-0">
              <ul class="w-full">
                <li
                  v-for="altChord in alternativeChords"
                  :key="altChord.symbol"
                  class="px-3 py-2 hover:bg-base-200 rounded-md cursor-pointer"
                  @click="goToChordDetail(altChord.tonic + altChord.aliases[0])"
                >
                  <ChordName :chord="altChord" />
                </li>
              </ul>
            </div>
          </details>
        </section>
      </div>

      <div class="flex flex-row flex-wrap gap-6 w-full mb-4">
        <section
          class="flex-basis-[320px] flex-grow min-w-[280px] p-4 bg-base-200/50 rounded-lg"
        >
          <details class="collapse collapse-arrow bg-base-200/30">
            <summary
              class="collapse-title text-base font-semibold text-base-content/80 uppercase tracking-wide"
            >
              {{ t("chordDictionary.inversions") }}
            </summary>
            <div class="collapse-content pt-0">
              <div
                v-for="(_, index) in chord.intervals"
                :key="index"
                v-show="index > 0"
                class="flex flex-row items-center flex-wrap w-full gap-4 p-4 mb-2 bg-base-200/50 rounded-md"
              >
                <div class="flex-basis-[200px] flex-grow-0">
                  <ChordName
                    :chord="getSlashChord(index)"
                    class="text-3xl font-semibold"
                  />
                  <div class="text-sm italic text-base-content/80">
                    {{
                      t("chordDictionary.inversionOn", {
                        interval: getInterval(index),
                      })
                    }}
                  </div>
                  <div v-if="getAltChord(index)" class="text-xs mt-4">
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
                />
              </div>
            </div>
          </details>
        </section>
      </div>

      <div class="flex flex-row flex-wrap gap-6 w-full mb-4">
        <section
          v-if="subsetChords.length"
          class="flex-basis-[320px] flex-grow min-w-[280px] p-4 bg-base-200/50 rounded-lg"
        >
          <details class="collapse collapse-arrow bg-base-200/30">
            <summary
              class="collapse-title text-base font-semibold text-base-content/80 uppercase tracking-wide"
            >
              {{ t("chordDictionary.simplified") }}
            </summary>
            <div class="collapse-content pt-0">
              <div class="flex flex-wrap gap-2">
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
          </details>
        </section>

        <section
          v-if="supersetChords.length"
          class="flex-basis-[320px] flex-grow min-w-[280px] p-4 bg-base-200/50 rounded-lg"
        >
          <details class="collapse collapse-arrow bg-base-200/30">
            <summary
              class="collapse-title text-base font-semibold text-base-content/80 uppercase tracking-wide"
            >
              {{ t("chordDictionary.extended") }}
            </summary>
            <div class="collapse-content pt-0">
              <div class="flex flex-wrap gap-2">
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
          </details>
        </section>
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
import { useChordDictionaryModule } from "../ChordDictionaryModuleProvider";
import {
  getChordInversion,
  getAlternativeChords,
  getSubsetChords,
  getSupersetChords,
} from "./utils";
import {
  ALIAS_NOTATION,
  getChordDegrees,
  getNoteInKeySignature,
} from "@/helpers";
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

const preferredAlias = computed(() => {
  if (!chord.value) return null;
  const alias = settingsStore.settings.chordDictionary.aliases.find(
    (a) => a[0] === chord.value!.aliases[0],
  );
  return alias ? alias[1] : null;
});

const staffClef = computed(() => settingsStore.settings.notation.staffClef);
const staffTranspose = computed(
  () => settingsStore.settings.notation.staffTranspose,
);

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
  const aliases = settingsStore.settings.chordDictionary.aliases.filter(
    (a) => a[0] !== chord.value!.aliases[0],
  );

  if (!isPreferred) {
    settingsStore.updateSetting("chordDictionary.aliases", [
      ...aliases,
      [chord.value!.aliases[0], alias],
    ]);
  } else {
    settingsStore.updateSetting("chordDictionary.aliases", aliases);
  }
}

function isPreferred(index: number): boolean {
  return preferredAlias.value === chord.value!.aliases[index];
}

function isDefault(index: number): boolean {
  return (
    preferredAlias.value === null &&
    index ===
      ALIAS_NOTATION[
        settingsStore.settings.chordDictionary.defaultNotation ||
          ("long" as keyof typeof ALIAS_NOTATION)
      ]
  );
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
