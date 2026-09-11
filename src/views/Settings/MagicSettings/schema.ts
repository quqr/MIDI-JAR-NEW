import type { SettingsGroupSchema } from "@/components/Settings/schema";

/**
 * 界面特效设置 schema。
 * label key 解析规则：`${i18nPrefix}.${labelKey ?? key 末段}`，
 * Hint 自动探测 `${prefix}.${baseKey}Hint`（存在才渲染）。
 */
export const magicGroups: readonly SettingsGroupSchema[] = [
  {
    titleKey: "settings.magicSettings.title",
    icon: "sparkles",
    fields: [
      { key: "enabled", control: "toggle" },
      {
        key: "borderGlow",
        control: "toggle",
        visibleWhen: (model) => Boolean(model.enabled),
      },
      {
        key: "glowIntensity",
        control: "range",
        min: 0.1,
        max: 1,
        step: 0.05,
        visibleWhen: (model) =>
          Boolean(model.enabled) && Boolean(model.borderGlow),
      },
      {
        key: "glowWidth",
        control: "range",
        min: 2,
        max: 16,
        step: 1,
        visibleWhen: (model) =>
          Boolean(model.enabled) && Boolean(model.borderGlow),
      },
      {
        key: "spotlight",
        control: "toggle",
        visibleWhen: (model) => Boolean(model.enabled),
      },
      {
        key: "spotlightRadius",
        control: "range",
        min: 150,
        max: 600,
        step: 10,
        visibleWhen: (model) =>
          Boolean(model.enabled) && Boolean(model.spotlight),
      },
      {
        key: "spotlightOpacity",
        control: "range",
        min: 0.1,
        max: 1,
        step: 0.05,
        visibleWhen: (model) =>
          Boolean(model.enabled) && Boolean(model.spotlight),
      },
      {
        key: "tilt",
        control: "toggle",
        visibleWhen: (model) => Boolean(model.enabled),
      },
      {
        key: "tiltMaxAngle",
        control: "range",
        min: 0,
        max: 15,
        step: 1,
        visibleWhen: (model) => Boolean(model.enabled) && Boolean(model.tilt),
      },
      {
        key: "magnetism",
        control: "toggle",
        visibleWhen: (model) => Boolean(model.enabled),
      },
      {
        key: "magnetismStrength",
        control: "range",
        min: 0,
        max: 0.2,
        step: 0.01,
        visibleWhen: (model) =>
          Boolean(model.enabled) && Boolean(model.magnetism),
      },
      {
        key: "clickEffect",
        control: "toggle",
        visibleWhen: (model) => Boolean(model.enabled),
      },
      {
        key: "rippleSize",
        control: "range",
        min: 0.5,
        max: 3,
        step: 0.1,
        visibleWhen: (model) =>
          Boolean(model.enabled) && Boolean(model.clickEffect),
      },
      {
        key: "rippleDuration",
        control: "range",
        min: 300,
        max: 1200,
        step: 50,
        visibleWhen: (model) =>
          Boolean(model.enabled) && Boolean(model.clickEffect),
      },
      {
        key: "glowColor",
        control: "color",
        visibleWhen: (model) =>
          Boolean(model.enabled) &&
          Boolean(model.borderGlow || model.spotlight || model.clickEffect),
      },
    ],
  },
];
