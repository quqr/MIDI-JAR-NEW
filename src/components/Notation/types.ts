import type { KeySignatureConfig } from "@/helpers";

export type StaffClef = "both" | "bass" | "treble";

export type NotationDisplayConfig = {
  clef: boolean;
  keySignature: boolean;
  keySignatureText: boolean;
  barlines: boolean;
  timeSignature: boolean;
  noteNames: boolean;
  staffLines: boolean;
};

export type NotationLayoutConfig = {
  paddingTop: number;
  staveHeight: number;
  staveGap: number;
  textHeight: number;
  bottomPadding: number;
  sidePadding: number;
  clefWidth: number;
  noteWidth: number;
  keySignatureWidthPerAlteration: number;
  maxScale: number;
};

export type NotationStyleConfig = {
  backgroundColor: string;
  staffLineColor: string;
  noteColor: string;
  noteHighlightColor: string | null;
  fontSize: number;
};

export type NotationProps = {
  id?: string;
  className?: string;
  midiNotes?: number[];
  keySignature: KeySignatureConfig;
  staffClef?: StaffClef;
  staffTranspose?: number;
  display?: Partial<NotationDisplayConfig>;
  layout?: Partial<NotationLayoutConfig>;
  style?: Partial<NotationStyleConfig>;
};

export type LayoutDimensions = {
  totalWidth: number;
  totalHeight: number;
  staveWidth: number;
  staveHeight: number;
  scale: number;
  trebleY: number;
  bassY: number;
  singleY: number;
  keySignatureWidth: number;
  clefWidth: number;
  noteStartX: number;
};

export const defaultDisplayConfig: NotationDisplayConfig = {
  clef: true,
  keySignature: true,
  keySignatureText: true,
  barlines: false,
  timeSignature: false,
  noteNames: false,
  staffLines: true,
};

export const defaultLayoutConfig: NotationLayoutConfig = {
  paddingTop: 40,
  staveHeight: 140,
  staveGap: 0,
  textHeight: 30,
  bottomPadding: 30,
  sidePadding: 40,
  clefWidth: 50,
  noteWidth: 120,
  keySignatureWidthPerAlteration: 120,
  maxScale: 1.5,
};

export const defaultStyleConfig: NotationStyleConfig = {
  backgroundColor: "transparent",
  staffLineColor: "#000000",
  noteColor: "#000000",
  noteHighlightColor: null,
  fontSize: 10,
};
