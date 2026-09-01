<template>
  <SettingsCollapse
    v-if="isVisible"
    :title="title"
    :icon="icon"
    :default-open="true"
    :open="isOpen"
    :section-id="sectionId"
    @update:open="$emit('update:open', $event)"
  >
    <slot v-if="slotPosition === 'before'" />
    <template v-for="field in visibleFields" :key="field.key">
      <div
        v-if="field.control === 'heading'"
        class="divider text-xs text-base-content/70"
      >
        {{ headingLabel(field) }}
      </div>
      <SettingsToggle
        v-else-if="field.control === 'toggle'"
        :model-value="booleanValue(field)"
        :label="label(field)"
        :description="description(field)"
        :disabled="isDisabled(field)"
        @update:model-value="update(field, $event)"
      />
      <SettingsRange
        v-else-if="field.control === 'range'"
        :model-value="numberValue(field)"
        :label="label(field)"
        :description="description(field)"
        :min="rangeOf(field).min"
        :max="rangeOf(field).max"
        :step="rangeOf(field).step"
        :disabled="isDisabled(field)"
        @update:model-value="update(field, $event)"
      />
      <SettingsColorPicker
        v-else-if="field.control === 'color'"
        :model-value="stringValue(field)"
        :label="label(field)"
        :description="description(field)"
        :disabled="isDisabled(field)"
        @update:model-value="update(field, $event)"
      />
      <template v-else-if="field.control === 'themeAwareColor'">
        <SettingsColorPicker
          v-if="isCustomColorSource(field)"
          :model-value="stringValue(field)"
          :label="label(field)"
          :description="description(field)"
          :disabled="isDisabled(field)"
          @update:model-value="update(field, $event)"
        />
        <SettingsThemeColorPicker
          v-else
          :model-value="stringValue(field)"
          :label="themeAwareThemeLabel(field)"
          :disabled="isDisabled(field)"
          @update:model-value="update(field, $event)"
        />
      </template>
      <SettingsSelect
        v-else-if="field.control === 'select'"
        :model-value="(getPathValue(model, field.key) as string | number) ?? ''"
        :label="label(field)"
        :description="description(field)"
        :options="optionsOf(field)"
        :disabled="isDisabled(field)"
        @update:model-value="update(field, $event)"
      />
      <SettingsRadioGroup
        v-else-if="field.control === 'radio'"
        :model-value="(getPathValue(model, field.key) as string | number) ?? ''"
        :label="label(field)"
        :description="description(field)"
        :options="optionsOf(field)"
        :disabled="isDisabled(field)"
        @update:model-value="update(field, $event)"
      />
      <SettingsTextInput
        v-else-if="field.control === 'textInput'"
        :model-value="(getPathValue(model, field.key) as string) ?? ''"
        :label="label(field)"
        :description="description(field)"
        :disabled="isDisabled(field)"
        @update:model-value="update(field, $event)"
      />
    </template>
    <slot v-if="slotPosition !== 'before'" />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingsCollapse from "./SettingsCollapse.vue";
import SettingsColorPicker from "./SettingsColorPicker.vue";
import SettingsRadioGroup from "./SettingsRadioGroup.vue";
import SettingsRange from "./SettingsRange.vue";
import SettingsSelect from "./SettingsSelect.vue";
import SettingsTextInput from "./SettingsTextInput.vue";
import SettingsThemeColorPicker from "./SettingsThemeColorPicker.vue";
import SettingsToggle from "./SettingsToggle.vue";
import { getPathValue, labelBaseKey } from "./schema";
import type { IconName } from "@/components/Icon/types";
import type {
  SettingsFieldModel,
  SettingsFieldOption,
  SettingsFieldSchema,
  SettingsFieldValue,
} from "./schema";

/**
 * 通用 schema 驱动设置组渲染器：读取字段描述循环生成对应 Settings 控件。
 * standard/debug 两个 variant 仅差异在 range 范围宽窄（schema 的 debugMin/debugMax/debugStep）。
 * 各设置页面的 schema 放在各自视图目录的 schema.ts 中。
 */
interface Props {
  fields: readonly SettingsFieldSchema[];
  /** 已 merge 默认值的完整配置对象（支持点路径 key 读取嵌套值） */
  model: SettingsFieldModel;
  /** 折叠面板标题 i18n key */
  titleKey: string;
  /** 折叠面板图标 */
  icon?: IconName;
  /** 字段 label/Hint 的 i18n 前缀 */
  i18nPrefix?: string;
  /** standard = 正式设置页（窄范围）；debug = AdvancedDebug（宽范围） */
  variant?: "standard" | "debug";
  /** 默认插槽位置：after = 字段之后（缺省），before = 字段之前（混排动态列表用） */
  slotPosition?: "before" | "after";
  /** 外部控制展开状态（v-model:open，供搜索过滤场景使用） */
  open?: boolean;
  /** 唯一标识，用于搜索过滤 */
  sectionId?: string;
  /** 搜索关键词，非空时仅当标题匹配才显示 */
  searchQuery?: string;
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  i18nPrefix: "settings",
  variant: "standard",
  slotPosition: "after",
  open: undefined,
  sectionId: undefined,
  searchQuery: "",
});

const emit = defineEmits<{
  (e: "update", key: string, value: SettingsFieldValue): void;
  (e: "update:open", value: boolean): void;
}>();

const { t, te, tm, rt } = useI18n();

const title = computed(() => t(props.titleKey));

const isVisible = computed(() => {
  const q = props.searchQuery.trim().toLowerCase();
  if (!q) return true;
  return title.value.toLowerCase().includes(q);
});

// 搜索激活时强制展开；否则使用外部 open 值
const isOpen = computed(() => {
  if (props.searchQuery.trim()) return true;
  return props.open;
});

const visibleFields = computed(() =>
  props.fields.filter((f) => !f.visibleWhen || f.visibleWhen(props.model)),
);

function label(field: SettingsFieldSchema): string {
  const base = t(`${props.i18nPrefix}.${labelBaseKey(field)}`);
  return field.labelPrefixKey
    ? `${t(`${props.i18nPrefix}.${field.labelPrefixKey}`)} · ${base}`
    : base;
}

function headingLabel(field: SettingsFieldSchema): string {
  return field.labelKey ? t(`${props.i18nPrefix}.${field.labelKey}`) : "";
}

function description(field: SettingsFieldSchema): string | undefined {
  const hintKey = `${props.i18nPrefix}.${field.descriptionKey ?? `${labelBaseKey(field)}Hint`}`;
  return te(hintKey) ? t(hintKey) : undefined;
}

function themeAwareThemeLabel(field: SettingsFieldSchema): string {
  return t(`${props.i18nPrefix}.${labelBaseKey(field)}Theme`);
}

function isDisabled(field: SettingsFieldSchema): boolean {
  return field.disabledWhen?.(props.model) ?? false;
}

function isCustomColorSource(field: SettingsFieldSchema): boolean {
  return (
    getPathValue(props.model, field.sourceKey ?? `${field.key}Source`) ===
    "custom"
  );
}

function booleanValue(field: SettingsFieldSchema): boolean {
  const raw = getPathValue(props.model, field.key);
  return Boolean(raw ?? field.fallback ?? false);
}

function numberValue(field: SettingsFieldSchema): number {
  const raw = getPathValue(props.model, field.key);
  return Number(raw ?? field.fallback ?? 0);
}

function stringValue(field: SettingsFieldSchema): string {
  const raw = getPathValue(props.model, field.key);
  return (raw ?? field.fallback ?? "") as string;
}

function rangeOf(field: SettingsFieldSchema): {
  min: number;
  max: number;
  step: number;
} {
  if (props.variant === "debug" && field.debugMin !== undefined) {
    return {
      min: field.debugMin,
      max: field.debugMax ?? field.max ?? field.debugMin,
      step: field.debugStep ?? field.step ?? 1,
    };
  }
  return { min: field.min ?? 0, max: field.max ?? 100, step: field.step ?? 1 };
}

function resolveMessage(message: unknown): string {
  return rt(message as Parameters<typeof rt>[0]) as string;
}

function optionsOf(field: SettingsFieldSchema): SettingsFieldOption[] {
  if (field.options) return field.options;
  if (!field.optionsKey) return [];
  const record = tm(field.optionsKey) as Record<string, unknown> | undefined;
  if (!record) return [];
  return Object.entries(record)
    .filter(([key]) => !key.endsWith("Hint"))
    .map(([value, message]) => {
      const hintKey = `${field.optionsKey}.${value}Hint`;
      const option: SettingsFieldOption = {
        value,
        label: resolveMessage(message),
      };
      if (te(hintKey)) option.hint = t(hintKey);
      return option;
    });
}

/** onChange 副作用钩子用于追加写回其它字段（value 允许 undefined 以清除字段） */
function hookEmit(key: string, value: SettingsFieldValue | undefined): void {
  emit("update", key, value as SettingsFieldValue);
}

function update(field: SettingsFieldSchema, value: SettingsFieldValue): void {
  emit("update", field.key, value);
  field.onChange?.(value, props.model, hookEmit);
}
</script>
