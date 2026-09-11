import type {
  SettingsFieldSchema,
  SettingsFieldValue,
  SettingsGroupSchema,
} from "@/components/Settings/schema";
import type { IconName } from "@/components/Icon/types";
import { getThemeColors, type PianoTheme } from "./config/pianoThemes";
import type { WaterfallPianoSettings } from "./types";

/** 瀑布流设置字段 schema：正式设置页与 AdvancedDebug 共用（差异经字段 key/前缀/debug range 表达） */

type FieldChangeEmit = (
  key: string,
  value: SettingsFieldValue | undefined,
) => void;

const particleGate = (m: Record<string, unknown>) =>
  Boolean((m.hitLine as Record<string, unknown> | undefined)?.visible);
const colorSchemeCustom = (m: Record<string, unknown>) =>
  m.colorScheme === "custom";
const blockParticleGate = (m: Record<string, unknown>) =>
  Boolean((m.blockParticle as Record<string, unknown> | undefined)?.enabled);

/* ─── 渲染层级组织 ───────────────────────────────────────────────
 * 用户视角的设置分组 = 引擎渲染层级（从底到顶）：
 *   1. 背景色层（纯色 + 自定义背景图片）
 *   2. 特殊效果层（galaxy 星系 + bloom/blur 后期）
 *   3. 流体模拟层（fluid 基础 + 高级参数）
 *   4. Note Block 层（方块外观/配色 + 粒子方块 + 光晕）
 *   5. 钢琴层
 *   6. UI 层（其余不适合上述层级的组）
 * 新增层级只需向 LAYERS 追加一项；数组顺序即渲染顺序。
 * 一个层级组可跨多个设置段（section），字段经 LayerFieldEntry 显式归属。
 * ────────────────────────────────────────────────────────────── */

type SettingsSectionKey = keyof WaterfallPianoSettings;

/** 层级字段条目：字段 + 所属设置段（层级组可跨 section） */
export interface LayerFieldEntry {
  section: SettingsSectionKey;
  field: SettingsFieldSchema;
  /**
   * 进阶参数标记（ADR 0024）：仅在全局设置页展示，
   * 侧边设置抽屉过滤隐藏（如流体"随机扰动"干扰抖动组）。
   */
  advanced?: boolean;
}

/** 渲染层级组：id + 标题 i18n key + 图标 + 字段条目（数组顺序 = 渲染顺序） */
export interface LayerGroupSchema {
  id: string;
  titleKey: string;
  icon?: IconName;
  fields: readonly LayerFieldEntry[];
}

const f = (
  section: SettingsSectionKey,
  field: SettingsFieldSchema,
): LayerFieldEntry => ({ section, field });

/** 将既有 SettingsGroupSchema 的字段按指定 section 包装为层级条目 */
const ofGroup = (
  section: SettingsSectionKey,
  group: SettingsGroupSchema,
): LayerFieldEntry[] => group.fields.map((field) => f(section, field));

/**
 * 标记进阶字段：key 匹配给定前缀（或精确 key）的条目置 advanced=true。
 * 用于把高频干扰项（随机扰动/抖动）从侧边抽屉移到全局设置页。
 */
const markAdvanced = (
  entries: LayerFieldEntry[],
  ...keys: Array<string | RegExp>
): LayerFieldEntry[] =>
  entries.map((entry) =>
    keys.some((k) =>
      typeof k === "string" ? entry.field.key === k : k.test(entry.field.key),
    )
      ? { ...entry, advanced: true }
      : entry,
  );

const auraEnabled = (m: Record<string, unknown>) => Boolean(m.enabled);
const auraStyle = (m: Record<string, unknown>) => m.style;
const auraStyleIs =
  (...styles: string[]) =>
  (m: Record<string, unknown>) =>
    auraEnabled(m) && styles.includes(auraStyle(m) as string);

export const particlesGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.particles",
  icon: "sparkles",
  fields: [
    {
      key: "colorScheme",
      control: "select",
      optionsKey: "WaterfallPiano.scheme",
    },
    { key: "speed", control: "range", min: 0, max: 5, step: 0.1 },
    { key: "lookAhead", control: "range", min: 0, max: 10, step: 0.5 },
    { key: "opacity", control: "range", min: 0, max: 1, step: 0.05 },
    { key: "cornerRadius", control: "range", min: 0, max: 20, step: 1 },
    {
      key: "hitExplosionRadius",
      control: "range",
      min: 0,
      max: 0.1,
      step: 0.005,
    },
    { key: "hitLine.visible", control: "toggle", labelKey: "hitLine" },
    {
      key: "hitLine.color",
      control: "color",
      labelKey: "hitLine",
      visibleWhen: particleGate,
    },
    {
      key: "hitLine.thickness",
      control: "range",
      labelKey: "hitLine",
      min: 0,
      max: 10,
      step: 1,
      visibleWhen: particleGate,
    },
    {
      key: "customColors.low",
      control: "color",
      labelKey: "low",
      visibleWhen: colorSchemeCustom,
    },
    {
      key: "customColors.mid",
      control: "color",
      labelKey: "mid",
      visibleWhen: colorSchemeCustom,
    },
    {
      key: "customColors.high",
      control: "color",
      labelKey: "high",
      visibleWhen: colorSchemeCustom,
    },
    {
      key: "blockParticle.enabled",
      control: "toggle",
      labelKey: "blockParticle",
    },
    {
      key: "blockParticle.gridSize",
      control: "range",
      labelKey: "blockParticleGridSize",
      min: 3,
      max: 14,
      step: 1,
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.particleSize",
      control: "range",
      labelKey: "blockParticleParticleSize",
      min: 1,
      max: 14,
      step: 0.5,
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.entryGather",
      control: "toggle",
      labelKey: "blockParticleEntryGather",
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.scatter",
      control: "range",
      labelKey: "blockParticleScatter",
      min: 0,
      max: 160,
      step: 5,
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.stagger",
      control: "range",
      labelKey: "blockParticleStagger",
      min: 0,
      max: 1500,
      step: 10,
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.highlightColor",
      control: "color",
      labelKey: "blockParticleHighlightColor",
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.idleDrift",
      control: "range",
      labelKey: "blockParticleIdleDrift",
      min: 0,
      max: 4,
      step: 0.1,
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.pointerRepelRadius",
      control: "range",
      labelKey: "blockParticleRepelRadius",
      min: 0,
      max: 200,
      step: 5,
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.pointerRepelForce",
      control: "range",
      labelKey: "blockParticleRepelForce",
      min: 0,
      max: 80,
      step: 1,
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.burstStrength",
      control: "range",
      labelKey: "blockParticleBurst",
      min: 0,
      max: 160,
      step: 5,
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.gatherDuration",
      control: "range",
      labelKey: "blockParticleGather",
      min: 200,
      max: 2000,
      step: 50,
      visibleWhen: blockParticleGate,
    },
    {
      key: "blockParticle.glow",
      control: "toggle",
      labelKey: "blockParticleGlow",
      visibleWhen: blockParticleGate,
    },
  ],
};

export const auraGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.aura",
  icon: "sparkles",
  fields: [
    { key: "enabled", control: "toggle", labelKey: "auraEnabled" },
    {
      key: "auraGroup.area",
      control: "heading",
      labelKey: "auraGroups.area",
      visibleWhen: auraEnabled,
    },
    {
      key: "padding",
      control: "range",
      min: 0,
      max: 30,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "auraGroup.glowLayers",
      control: "heading",
      labelKey: "auraGroups.glowLayers",
      visibleWhen: auraEnabled,
    },
    {
      key: "innerBlur",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "innerOpacity",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "outerBlur",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "outerOpacity",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "auraGroup.animation",
      control: "heading",
      labelKey: "auraGroups.animation",
      visibleWhen: auraEnabled,
    },
    {
      key: "duration",
      control: "range",
      min: 0,
      max: 60,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "auraGroup.glowSettings",
      control: "heading",
      labelKey: "auraGroups.glowSettings",
      visibleWhen: auraStyleIs("glow"),
    },
    {
      key: "glowPeakOpacity",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraStyleIs("glow"),
    },
    {
      key: "glowPeakBlur",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraStyleIs("glow"),
    },
    {
      key: "glowAfterPeakOpacity",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraStyleIs("glow"),
    },
    {
      key: "glowAfterPeakBlur",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraStyleIs("glow"),
    },
    {
      key: "auraGroup.colors",
      control: "heading",
      labelKey: "auraGroups.colors",
      visibleWhen: auraStyleIs("custom"),
    },
    {
      key: "primaryColor",
      control: "color",
      fallback: "#6366f1",
      visibleWhen: auraStyleIs("custom"),
    },
  ],
};

const fluidGate = (m: Record<string, unknown>) => Boolean(m.fluidEnabled);
const fluidParamsOf = (m: Record<string, unknown>) =>
  (m.fluidParams as Record<string, unknown> | undefined) ?? {};

const galaxyOf = (m: Record<string, unknown>) =>
  (m.galaxy as Record<string, unknown> | undefined) ?? {};
const galaxyEnabled = (m: Record<string, unknown>) =>
  Boolean(galaxyOf(m).enabled);
const galaxyManualHue = (m: Record<string, unknown>) =>
  galaxyEnabled(m) && !galaxyOf(m).useThemeColors;

export const backgroundGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.background",
  icon: "image",
  fields: [{ key: "solidColor", control: "color" }],
};

export const galaxyGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.galaxy",
  icon: "sparkles",
  fields: [
    { key: "galaxy.enabled", control: "toggle", labelKey: "galaxyEnabled" },
    {
      key: "galaxy.useThemeColors",
      control: "toggle",
      labelKey: "galaxyUseThemeColors",
      visibleWhen: galaxyEnabled,
    },
    {
      key: "galaxy.density",
      control: "range",
      labelKey: "galaxyDensity",
      min: 0.2,
      max: 2,
      step: 0.1,
      visibleWhen: galaxyEnabled,
    },
    {
      key: "galaxy.glowIntensity",
      control: "range",
      labelKey: "galaxyGlowIntensity",
      min: 0,
      max: 1,
      step: 0.05,
      visibleWhen: galaxyEnabled,
    },
    {
      key: "galaxy.saturation",
      control: "range",
      labelKey: "galaxySaturation",
      min: 0,
      max: 1,
      step: 0.05,
      visibleWhen: galaxyEnabled,
    },
    {
      key: "galaxy.hueShift",
      control: "range",
      labelKey: "galaxyHueShift",
      min: 0,
      max: 360,
      step: 5,
      visibleWhen: galaxyManualHue,
    },
    {
      key: "galaxy.rotationSpeed",
      control: "range",
      labelKey: "galaxyRotationSpeed",
      min: 0,
      max: 1,
      step: 0.05,
      visibleWhen: galaxyEnabled,
    },
    {
      key: "galaxy.starSpeed",
      control: "range",
      labelKey: "galaxyStarSpeed",
      min: 0,
      max: 1,
      step: 0.05,
      visibleWhen: galaxyEnabled,
    },
    {
      key: "galaxy.speed",
      control: "range",
      labelKey: "galaxySpeed",
      min: 0,
      max: 3,
      step: 0.1,
      visibleWhen: galaxyEnabled,
    },
  ],
};

export const fluidGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.fluid",
  icon: "droplet",
  fields: [
    { key: "fluidEnabled", control: "toggle" },
    {
      key: "fluidParams.simResolution",
      control: "range",
      labelKey: "fluidQuality",
      min: 0,
      max: 256,
      step: 32,
      fallback: 128,
      visibleWhen: fluidGate,
    },
    {
      key: "fluidStyle",
      control: "select",
      optionsKey: "WaterfallPiano.fluidStyleOptions",
      visibleWhen: fluidGate,
    },
    {
      key: "fluidLayerPosition",
      control: "select",
      optionsKey: "WaterfallPiano.fluidLayerPositionOptions",
      visibleWhen: fluidGate,
    },
  ],
};

export const fluidAdvancedGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.fluidAdvancedParams",
  icon: "droplet",
  fields: [
    {
      key: "fluidParams.splatRadius",
      control: "range",
      min: 0,
      max: 0.01,
      step: 0.0001,
      fallback: 0.0001,
    },
    {
      key: "fluidParams.splatColorHue",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
      fallback: 0,
    },
    {
      key: "fluidParams.trailLength",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
      fallback: 0.2,
    },
    {
      key: "fluidParams.flowPersistence",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
      fallback: 0.2,
    },
    { key: "fluidParams.bloom", control: "toggle", fallback: true },
    {
      key: "fluidParams.bloomIntensity",
      control: "range",
      min: 0,
      max: 2,
      step: 0.1,
      fallback: 0.8,
      visibleWhen: (m) => fluidParamsOf(m).bloom !== false,
    },
    { key: "fluidParams.hitExplosion", control: "toggle", fallback: false },
    { key: "fluidParams.blockCoverage", control: "toggle", fallback: false },
    { key: "fluidParams.group", control: "heading", labelKey: "perturbation" },
    ...(
      [
        "fluidSplatPerturbation",
        "hitExplosionPerturbation",
        "blockCoveragePerturbation",
        "sustainedSplatPerturbation",
      ] as const
    ).flatMap((group) =>
      (
        [
          ["positionJitter", "positionJitter"],
          ["forceJitter", "forceJitter"],
          ["colorJitter", "colorJitter"],
        ] as const
      ).map(
        ([sub, labelKey]) =>
          ({
            key: `fluidParams.${group}.${sub}`,
            control: "range",
            labelKey,
            labelPrefixKey: group,
            min: 0,
            max: 1,
            step: 0.05,
            fallback: 0.5,
          }) satisfies SettingsFieldSchema,
      ),
    ),
  ],
};

const bloomGate = (m: Record<string, unknown>) =>
  Boolean(m.advancedBloomEnabled);
const blurGate = (m: Record<string, unknown>) => Boolean(m.backdropBlurEnabled);

export const effectsGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.effects",
  icon: "filter",
  fields: [
    { key: "advancedBloomEnabled", control: "toggle" },
    {
      key: "advancedBloomThreshold",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
      visibleWhen: bloomGate,
    },
    {
      key: "advancedBloomBloomScale",
      control: "range",
      min: 0,
      max: 5,
      step: 0.1,
      visibleWhen: bloomGate,
    },
    {
      key: "advancedBloomBlur",
      control: "range",
      min: 0,
      max: 20,
      step: 0.5,
      visibleWhen: bloomGate,
    },
    { key: "effects.divider", control: "heading" },
    { key: "backdropBlurEnabled", control: "toggle" },
    {
      key: "backdropBlurStrength",
      control: "range",
      min: 0,
      max: 20,
      step: 0.5,
      visibleWhen: blurGate,
    },
  ],
};

/** 选主题时一键应用色板；value 为空时清除主题 */
function themeOnChange(
  value: SettingsFieldValue,
  _model: Record<string, unknown>,
  emit: FieldChangeEmit,
): void {
  if (!value) {
    emit("theme", undefined);
    return;
  }
  const colors = getThemeColors(value as PianoTheme);
  if (colors) {
    emit("whiteKeyColor", colors.whiteKeyColor);
    emit("blackKeyColor", colors.blackKeyColor);
    emit("pressedKeyColor", colors.pressedKeyColor);
    emit("keyBorderColor", colors.keyBorderColor);
    emit("separatorColor", colors.separatorColor);
  }
}

/** 单独修改颜色时清除主题，切回自定义模式 */
function clearColorTheme(
  _value: SettingsFieldValue,
  _model: Record<string, unknown>,
  emit: FieldChangeEmit,
): void {
  emit("theme", undefined);
}

export const keyboardGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.keyboard",
  icon: "piano",
  fields: [
    { key: "visible", control: "toggle", labelKey: "keyboard" },
    {
      key: "theme",
      control: "select",
      labelKey: "pianoTheme",
      optionsKey: "WaterfallPiano.themeOptions",
      fallback: "",
      onChange: themeOnChange,
    },
    {
      key: "range",
      control: "select",
      optionsKey: "WaterfallPiano.keyRangeOptions",
    },
    {
      key: "keyLabel",
      control: "select",
      optionsKey: "WaterfallPiano.keyLabelOptions",
    },
    { key: "heightRatio", control: "range", min: 0.1, max: 0.5, step: 0.05 },
    {
      key: "blackKeyHeightRatio",
      control: "range",
      min: 0.3,
      max: 0.8,
      step: 0.02,
    },
    {
      key: "keyCornerRadius",
      control: "range",
      labelKey: "cornerRadius",
      min: 0,
      max: 20,
      step: 1,
    },
    { key: "whiteKeyColor", control: "color", onChange: clearColorTheme },
    { key: "blackKeyColor", control: "color", onChange: clearColorTheme },
    { key: "pressedKeyColor", control: "color", onChange: clearColorTheme },
    { key: "separatorEnabled", control: "toggle", labelKey: "hitLine" },
    { key: "showNoteNames", control: "toggle" },
  ],
};

export const midiFileGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.midiFile",
  fields: [
    { key: "playbackSpeed", control: "range", min: 0.25, max: 2, step: 0.05 },
    { key: "loop", control: "toggle" },
  ],
};

/* ─── LAYERS：层级清单（数组顺序 = 渲染顺序）────────────────────── */

export const LAYERS: readonly LayerGroupSchema[] = [
  {
    id: "background",
    titleKey: "WaterfallPiano.layers.background",
    icon: "image",
    fields: [...ofGroup("background", backgroundGroup)],
  },
  {
    id: "specialEffects",
    titleKey: "WaterfallPiano.layers.specialEffects",
    icon: "filter",
    fields: [
      ...ofGroup("background", galaxyGroup),
      ...ofGroup("effects", effectsGroup),
    ],
  },
  {
    id: "fluid",
    titleKey: "WaterfallPiano.layers.fluid",
    icon: "droplet",
    fields: markAdvanced(
      [
        ...ofGroup("background", fluidGroup),
        ...ofGroup("background", fluidAdvancedGroup),
      ],
      "fluidParams.group",
      /Perturbation\./,
    ),
  },
  {
    id: "noteBlock",
    titleKey: "WaterfallPiano.layers.noteBlock",
    icon: "music-note",
    fields: [
      ...ofGroup("particles", particlesGroup),
      ...ofGroup("aura", auraGroup),
    ],
  },
  {
    id: "piano",
    titleKey: "WaterfallPiano.layers.piano",
    icon: "piano",
    fields: [...ofGroup("keyboard", keyboardGroup)],
  },
  {
    id: "ui",
    titleKey: "WaterfallPiano.layers.ui",
    icon: "settings",
    fields: [...ofGroup("midiFile", midiFileGroup)],
  },
];

/** 层级内顶层 key（字段 key 首段）→ 所属设置段，用于字段写回路由 */
export function layerSectionOf(
  layer: LayerGroupSchema,
  key: string,
): SettingsSectionKey | undefined {
  const top = key.split(".")[0];
  const entry = layer.fields.find((e) => e.field.key.split(".")[0] === top);
  return entry?.section;
}

/** 层级涉及的设置段（去重，按出现顺序） */
export function layerSections(layer: LayerGroupSchema): SettingsSectionKey[] {
  const out: SettingsSectionKey[] = [];
  for (const e of layer.fields) {
    if (!out.includes(e.section)) out.push(e.section);
  }
  return out;
}
