import { Chord } from "@tonaljs/chord";

export interface KeyboardSettingsSizes {
  radius: number;
  height: number;
  ratio: number;
  bevel: boolean;
}

export interface KeyboardSettingsColors {
  white: string | null;
  black: string | null;
  played: string | null;
  wrapped: string | null;
  sustained: string | null;
}

export interface KeyboardSettings {
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
  sizes: KeyboardSettingsSizes;
  colors: KeyboardSettingsColors;
}

export interface KeySignatureConfig {
  alteration: number;
  tonic: string;
  notes: readonly string[];
  scale: readonly string[];
}

export interface PianoKeyboardProps {
  id?: string;
  className?: string;
  keyboard?: KeyboardSettings;
  keySignature?: KeySignatureConfig;
  played?: number[];
  sustained?: number[];
  midi?: number[];
  targets?: number[] | null;
  exactTargets?: boolean;
  chord?: Chord | undefined;
}

export interface ClassicNoteDef {
  displayName: string;
  name: string;
  chroma: number;
  midi: number;
  offset: number;
  labelOffset: number;
}

export interface ClassicKeyboardKeys {
  width: number;
  height: number;
  whites: ClassicNoteDef[];
  blacks: ClassicNoteDef[];
  labels: ClassicNoteDef[];
}

export interface FlatNoteDef {
  displayName: string;
  name: string;
  chroma: number;
  midi: number;
  offset: number;
  labelOffset: number;
  isBlack: boolean;
}

export interface FlatKeyboardKeys {
  width: number;
  height: number;
  notes: FlatNoteDef[];
}
