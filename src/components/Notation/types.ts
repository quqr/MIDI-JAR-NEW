import type { KeySignatureConfig } from "@/helpers";

export type StaffClef = "both" | "bass" | "treble";

export type NotationDisplayConfig = {
  clef: boolean;
  keySignature: boolean;
  keySignatureText: boolean;
  barlines: boolean;
  /**
   * 单谱表渲染时是否按谱号过滤音符。
   * false = 渲染所有音符（单谱表显示完整音域），
   * true = 仅渲染匹配谱号的音符。
   * 历史硬编码默认值：false（renderer.ts L253）
   */
  filterClef: boolean;
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
  /**
   * noteStartX 的额外偏移量（像素，按 scale 缩放）。
   * 历史硬编码默认值：10（layout.ts L124）
   */
  noteStartXOffset: number;
  /**
   * 缩放比例下限（占容器宽度的比例）。
   * 历史硬编码默认值：0.8（layout.ts L63）
   */
  minScaleRatio: number;
};

export type NotationStyleConfig = {
  backgroundColor: string;
  staffLineColor: string;
  noteColor: string;
  fontSize: number;
  /**
   * VexFlow 音符时值字符串（"1"=全音符, "2"=二分音符, "4"=四分音符, "8"=八分音符等）。
   * 历史硬编码默认值："1"（utils.ts L72）
   */
  noteDuration: string;
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
  filterClef: false,
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
  noteStartXOffset: 10,
  minScaleRatio: 0.8,
};

export const defaultStyleConfig: NotationStyleConfig = {
  backgroundColor: "transparent",
  staffLineColor: "#000000",
  noteColor: "#000000",
  fontSize: 10,
  noteDuration: "1",
};
