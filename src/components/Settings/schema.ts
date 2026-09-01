import type { IconName } from "@/components/Icon/types";

/**
 * 通用设置字段 schema —— 所有设置页面共用的字段描述格式。
 *
 * 约定（新增字段时遵循，详见 docs/adr/0005）：
 * - label 的 i18n key = `${i18nPrefix}.${labelKey ?? labelBaseKey(field)}`，
 *   其中 labelBaseKey 取 labelKey ?? key 的最后一段（支持 "keyboard.from" 这类点路径 key）；
 * - Hint 自动探测 `${prefix}.${baseKey}Hint`（te()），存在才渲染，schema 中无需声明；
 * - select/radio 选项优先用 field.options（静态），否则用 field.optionsKey
 *   指向的 i18n 对象（子 key = value，兄弟 key `${value}Hint` 为可选 hint）。
 */
export type SettingsFieldControl =
  | "toggle"
  | "range"
  | "color"
  /** 颜色来源双模式：`${key}Source`（可用 sourceKey 覆盖）为 "custom" 时渲染 ColorPicker，否则 ThemeColorPicker */
  | "themeAwareColor"
  | "select"
  | "radio"
  | "textInput"
  /** 分组分隔标题：labelKey 缺省时渲染无文字分隔线 */
  | "heading";

export type SettingsFieldValue = boolean | number | string | null;

export type SettingsFieldOption = {
  value: string | number;
  label: string;
  hint?: string;
};

export type SettingsFieldModel = Record<string, unknown>;

export type SettingsFieldSchema = {
  key: string;
  control: SettingsFieldControl;
  /** 覆盖默认 label key（默认取 key 最后一段） */
  labelKey?: string;
  /** 组合 label 前缀：label = t(labelPrefixKey) + " · " + t(labelKey ?? key 末段) */
  labelPrefixKey?: string;
  /** 覆盖默认 Hint key（默认 `${baseKey}Hint`，te 探测） */
  descriptionKey?: string;
  /** 标准变体 range */
  min?: number;
  max?: number;
  step?: number;
  /** 调试变体 range 覆盖（缺省回落到标准 range） */
  debugMin?: number;
  debugMax?: number;
  debugStep?: number;
  /** 值为 undefined/null 时的显示兜底（不写回，仅展示） */
  fallback?: number | string | boolean;
  /** select/radio 的静态选项（优先于 optionsKey） */
  options?: SettingsFieldOption[];
  /** select/radio 的 i18n 选项对象 key（子 key = value，`${value}Hint` = 可选 hint） */
  optionsKey?: string;
  /** themeAwareColor 的来源字段 key，缺省 `${key}Source` */
  sourceKey?: string;
  /** 条件渲染（基于当前 model 值） */
  visibleWhen?: (model: SettingsFieldModel) => boolean;
  /** 条件禁用（基于当前 model 值） */
  disabledWhen?: (model: SettingsFieldModel) => boolean;
  /**
   * 字段更新后的副作用钩子（如"选主题一键应用色板/改颜色清主题"）。
   * emit 可用于追加写回其它字段；value 允许 undefined（用于清除字段，
   * 经渲染器转发时保持 undefined，不会被替换为 null）。
   */
  onChange?: (
    value: SettingsFieldValue,
    model: SettingsFieldModel,
    emit: (key: string, value: SettingsFieldValue | undefined) => void,
  ) => void;
};

/** 单个折叠面板的字段组：标题 + 图标 + 字段列表（数组顺序即渲染顺序） */
export type SettingsGroupSchema = {
  fields: readonly SettingsFieldSchema[];
  titleKey: string;
  icon?: IconName;
};

/** 按点路径读取嵌套值（"keyboard.sizes.height"） */
export function getPathValue(model: SettingsFieldModel, path: string): unknown {
  let current: unknown = model;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** 字段的 label/Hint 基础 key（不含 i18n 前缀） */
export function labelBaseKey(field: SettingsFieldSchema): string {
  return (field.labelKey ?? field.key).split(".").pop() ?? field.key;
}
