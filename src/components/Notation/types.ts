import type { KeySignatureConfig } from "@/helpers";

export type StaffClef = "both" | "bass" | "treble";

export type NotationProps = {
  id?: string;
  className?: string;
  midiNotes?: number[];
  keySignature: KeySignatureConfig;
  staffClef?: StaffClef;
  staffTranspose?: number;
};
