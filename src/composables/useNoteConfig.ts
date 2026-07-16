import { computed } from "vue";
import { getKeySignature, type KeySignatureConfig } from "@/helpers";
import { MIDI_CHANNEL_ALL } from "./useMidiHandler";

export interface UseNotesOptions {
  accidentals?: "flat" | "sharp" | (() => "flat" | "sharp");
  key?: string | (() => string);
  midiChannel?: number;
  allowOmissions?: boolean | (() => boolean);
  useSustain?: boolean | (() => boolean);
  detectOnRelease?: boolean | (() => boolean);
  disabledChords?: string[] | (() => string[]);
  namespace?: string;
}

export function resolveOption<T>(
  option: T | (() => T) | undefined,
  defaultValue: T,
): T {
  if (option === undefined) return defaultValue;
  return typeof option === "function" ? (option as () => T)() : option;
}

export function toGetter<T>(option: T | (() => T) | undefined, defaultValue: T): () => T {
  return () => resolveOption(option, defaultValue);
}

export function useNoteConfig(options: UseNotesOptions = {}) {
  const accidentalsGetter = toGetter(options.accidentals, "flat" as const);
  const keyGetter = toGetter(options.key, "C");
  const allowOmissionsGetter = toGetter(options.allowOmissions, false);
  const useSustainGetter = toGetter(options.useSustain, true);
  const detectOnReleaseGetter = toGetter(options.detectOnRelease, true);
  const disabledChordsGetter = toGetter(options.disabledChords, [] as string[]);

  const keySignature = computed<KeySignatureConfig>(() => {
    const currentKey = keyGetter();
    const currentAccidentals = accidentalsGetter();
    return getKeySignature(currentKey, currentAccidentals === "sharp");
  });

  const midiChannel = options.midiChannel ?? MIDI_CHANNEL_ALL;
  const namespace = options.namespace ?? "debugger";

  return {
    keySignature,
    accidentalsGetter,
    keyGetter,
    allowOmissionsGetter,
    useSustainGetter,
    detectOnReleaseGetter,
    disabledChordsGetter,
    midiChannel,
    namespace,
  };
}
