import { ref, computed, watch, nextTick, provide, inject, type Ref, type ComputedRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Chord, Note } from "tonal";
import type { Chord as TChord } from "@tonaljs/chord";

import { useSettingsStore } from "@/stores/settings";
import { useChordDictionaryStore } from "@/stores/chordDictionary";
import { useChordDictionaryModule } from "../../ChordDictionaryModuleProvider";
import {
  getChordInversion,
  getAlternativeChords,
  getSubsetChords,
  getSupersetChords,
} from "../utils";
import {
  getChordDegrees,
  getNoteInKeySignature,
  type KeySignatureConfig,
} from "@/helpers";
import type {
  StaffClef,
  NotationDisplayConfig,
} from "@/components/Notation/types";

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

export interface ChordDetailContext {
  chordName: ComputedRef<string | undefined>;
  chord: ComputedRef<TChord | null>;
  isDisabled: ComputedRef<boolean>;
  detailRef: Ref<HTMLElement | null>;
  staffClef: ComputedRef<StaffClef>;
  staffTranspose: ComputedRef<number>;
  notationDisplay: ComputedRef<Partial<NotationDisplayConfig>>;
  keySignature: KeySignatureConfig;
  midi: ComputedRef<number[]>;
  midiNotes: number[];
  playedMidiNotes: number[];
  sustainedMidiNotes: number[];
  pitchClasses: string[];
  playedIntervals: ComputedRef<string[]>;
  alternativeChords: ComputedRef<TChord[]>;
  subsetChords: ComputedRef<TChord[]>;
  supersetChords: ComputedRef<TChord[]>;
  keyboardSettings: ComputedRef<typeof KEYBOARD_SETTINGS>;
  notationLabels: ComputedRef<string[]>;
  disableUpdate: boolean;
  t: ReturnType<typeof useI18n>["t"];
  goToChordDetail: (name: string) => void;
  toggleDisabled: (isEnabled: boolean | null) => void;
  toggleAlias: (isPreferred: boolean, alias: string) => void;
  isPreferred: (index: number) => boolean;
  isDefault: (index: number) => boolean;
  getSlashChord: (index: number) => TChord;
  getInterval: (index: number) => string;
  getInversionMidi: (index: number) => number[];
  getAltChord: (index: number) => TChord | undefined;
  getAltChordName: (index: number) => string;
}

const INJECTION_KEY = Symbol("chordDetailContext");

export function useChordDetail() {
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
    return chord.value!.intervals[index];
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

  const context: ChordDetailContext = {
    chordName,
    chord,
    isDisabled,
    detailRef,
    staffClef,
    staffTranspose,
    notationDisplay,
    keySignature,
    midi,
    midiNotes,
    playedMidiNotes,
    sustainedMidiNotes,
    pitchClasses,
    playedIntervals,
    alternativeChords,
    subsetChords,
    supersetChords,
    keyboardSettings,
    notationLabels,
    disableUpdate,
    t,
    goToChordDetail,
    toggleDisabled,
    toggleAlias,
    isPreferred,
    isDefault,
    getSlashChord,
    getInterval,
    getInversionMidi,
    getAltChord,
    getAltChordName,
  };

  provide(INJECTION_KEY, context);

  return context;
}

export function useChordDetailContext(): ChordDetailContext {
  const context = inject<ChordDetailContext>(INJECTION_KEY);
  if (!context) {
    throw new Error(
      "useChordDetailContext must be used within a ChordDetail component",
    );
  }
  return context;
}
