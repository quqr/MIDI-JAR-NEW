import type {
  NotationDisplayConfig,
  NotationLayoutConfig,
  NotationStyleConfig,
} from "./types";
import type { SettingsFieldSchema } from "@/components/Settings/schema";

export type NotationGroupKey = "display" | "layout" | "style";

type DisplayKey = keyof NotationDisplayConfig;
type LayoutKey = keyof NotationLayoutConfig;
type StyleKey = keyof NotationStyleConfig;

export type NotationFieldSchema<K extends string = string> =
  SettingsFieldSchema & { key: K };

/** 显示选项：5 个布尔开关 */
export const notationDisplayFieldSchema: readonly NotationFieldSchema<DisplayKey>[] =
  [
    { key: "clef", control: "toggle", labelKey: "showClef" },
    { key: "keySignature", control: "toggle", labelKey: "showKeySignature" },
    {
      key: "keySignatureText",
      control: "toggle",
      labelKey: "showKeySignatureText",
    },
    { key: "barlines", control: "toggle", labelKey: "showBarlines" },
    { key: "filterClef", control: "toggle" },
  ] as const;

/** 布局选项：12 个数值滑杆 */
export const notationLayoutFieldSchema: readonly NotationFieldSchema<LayoutKey>[] =
  [
    {
      key: "paddingTop",
      control: "range",
      min: 10,
      max: 100,
      step: 5,
      debugMin: 0,
      debugMax: 300,
    },
    {
      key: "staveHeight",
      control: "range",
      min: 80,
      max: 200,
      step: 10,
      debugMin: 40,
      debugMax: 500,
    },
    {
      key: "staveGap",
      control: "range",
      min: 0,
      max: 60,
      step: 5,
      debugMin: 0,
      debugMax: 200,
    },
    {
      key: "textHeight",
      control: "range",
      min: 10,
      max: 60,
      step: 5,
      debugMin: 0,
      debugMax: 200,
    },
    {
      key: "bottomPadding",
      control: "range",
      min: 10,
      max: 60,
      step: 5,
      debugMin: 0,
      debugMax: 200,
    },
    {
      key: "sidePadding",
      control: "range",
      min: 20,
      max: 100,
      step: 5,
      debugMin: 0,
      debugMax: 300,
    },
    {
      key: "clefWidth",
      control: "range",
      min: 30,
      max: 80,
      step: 5,
      debugMin: 10,
      debugMax: 200,
    },
    {
      key: "noteWidth",
      control: "range",
      min: 60,
      max: 200,
      step: 10,
      debugMin: 20,
      debugMax: 500,
    },
    {
      key: "keySignatureWidthPerAlteration",
      control: "range",
      min: 20,
      max: 500,
      step: 10,
    },
    {
      key: "maxScale",
      control: "range",
      min: 0.5,
      max: 2,
      step: 0.1,
      debugMin: 0.1,
      debugMax: 5,
    },
    { key: "noteStartXOffset", control: "range", min: 0, max: 100, step: 1 },
    { key: "minScaleRatio", control: "range", min: 0.1, max: 1, step: 0.05 },
  ] as const;

/** 样式选项：3 颜色 + 字号 + 音符时值 */
export const notationStyleFieldSchema: readonly NotationFieldSchema<StyleKey>[] =
  [
    { key: "backgroundColor", control: "color" },
    { key: "staffLineColor", control: "color" },
    { key: "noteColor", control: "color" },
    {
      key: "fontSize",
      control: "range",
      min: 6,
      max: 20,
      step: 1,
      debugMin: 2,
      debugMax: 60,
    },
    {
      key: "noteDuration",
      control: "select",
      options: [
        { value: "1", label: "1 · ♩ 全音符" },
        { value: "2", label: "2 · 二分音符" },
        { value: "4", label: "4 · ♩ 四分音符" },
        { value: "8", label: "8 · ♫ 八分音符" },
        { value: "16", label: "16 · 十六分音符" },
        { value: "32", label: "32 · 三十二分音符" },
      ],
    },
  ] as const;

/** 组 → 字段 schema 映射（数组顺序即 UI 渲染顺序） */
export const notationFieldSchemas: Record<
  NotationGroupKey,
  readonly SettingsFieldSchema[]
> = {
  display: notationDisplayFieldSchema,
  layout: notationLayoutFieldSchema,
  style: notationStyleFieldSchema,
};

/** 各组默认的正式页折叠面板标题 key（settings.notationSettings 下） */
export const notationGroupTitleKeys: Record<NotationGroupKey, string> = {
  display: "displayOptions",
  layout: "layoutOptions",
  style: "styleOptions",
};
