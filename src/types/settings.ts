export type KeyboardSettings = {
  skin: "classic" | "flat";
  from: string;
  to: string;
  label: "none" | "pitchClass" | "note" | "chordNote" | "interval";
  keyName: "none" | "octave" | "pitchClass" | "note";
  keyInfo: "none" | "tonic" | "interval" | "tonicAndInterval";
  fadeOutDuration: number;
  textOpacity: number;
  displaySustained: boolean;
  wrap: boolean;
  sizes: {
    radius: number;
    height: number;
    ratio: number;
    bevel: boolean;
  };
  colors: {
    white: string | null;
    black: string | null;
    played: string | null;
    wrapped: string | null;
    sustained: string | null;
  };
};

export type ChordDisplaySettings = {
  id: string;
  chordNotation: "long" | "short" | "symbol" | "preferred";
  useSustain: boolean;
  detectOnRelease: boolean;
  highlightAlterations: boolean;
  displayKeyboard: boolean;
  displayChord: boolean;
  displayName: boolean;
  displayNotation: boolean;
  displayAltChords: boolean;
  displayIntervals: boolean;
  keyboard: KeyboardSettings;
};

export type ChordDictionarySettings = {
  interactive: "detect" | "play";
  hideDisabled: boolean;
  filterInKey: boolean;
  groupBy: "none" | "quality" | "intervals";
  defaultNotation: "long" | "short" | "symbol";
  disabled: string[];
  aliases: Array<[key: string, value: string]>;
};

import type {
  NotationDisplayConfig,
  NotationLayoutConfig,
  NotationStyleConfig,
} from "@/components/Notation/types";

export type NotationSettings = {
  key: string;
  accidentals: "flat" | "sharp";
  staffClef: "both" | "bass" | "treble";
  staffTranspose: number;
  display: Partial<NotationDisplayConfig>;
  layout: Partial<NotationLayoutConfig>;
  style: Partial<NotationStyleConfig>;
};

export type CursorSettings = {
  enabled: boolean;
  innerSize: number;
  outerSize: number;
  innerColorSource: "custom" | "theme";
  innerColor: string;
  outerColorSource: "custom" | "theme";
  outerColor: string;
  hoverRingColorSource: "custom" | "theme";
  hoverRingColor: string;
  blendMode: "normal" | "exclusion" | "difference" | "multiply" | "screen";
  transitionDuration: number;
  hoverMode: "cover" | "border" | "none";
};

export type GeneralSettings = {
  language: "en" | "zh";
};

export type Settings = {
  general: GeneralSettings;
  cursor: CursorSettings;
  chordDisplay: ChordDisplaySettings[];
  chordDictionary: ChordDictionarySettings;
  notation: NotationSettings;
};
