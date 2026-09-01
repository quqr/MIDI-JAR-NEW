<template>
  <SettingsFieldGroup
    :fields="fields"
    :model="modelValue"
    :title-key="titleKey"
    :icon="resolvedIcon"
    :i18n-prefix="i18nPrefix"
    :variant="variant"
    :open="open"
    :section-id="sectionId"
    :search-query="searchQuery"
    @update="forwardUpdate"
    @update:open="emit('update:open', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import SettingsFieldGroup from "@/components/Settings/SettingsFieldGroup.vue";
import type { IconName } from "@/components/Icon/types";
import { notationFieldSchemas, notationGroupTitleKeys } from "./settingsSchema";
import type { NotationGroupKey } from "./settingsSchema";

/**
 * Notation 三组配置（display/layout/style）的字段组：
 * 字段清单/范围来自 settingsSchema.ts，渲染委托给通用 SettingsFieldGroup。
 * standard/debug 两个 variant 仅差异在 range 范围宽窄与 i18n 前缀。
 */
interface Props {
  /** 字段组，决定使用哪组 schema 与默认标题/图标 */
  group: NotationGroupKey;
  /** 调用方已 merge 好默认值的完整配置对象 */
  modelValue: Record<string, unknown>;
  /** standard = 正式设置页（窄范围）；debug = AdvancedDebug（宽范围） */
  variant?: "standard" | "debug";
  /** 折叠面板标题 i18n key（覆盖组默认值） */
  titleKey?: string;
  /** 折叠面板图标（覆盖组默认值） */
  icon?: IconName;
  /** 字段 label/Hint 的 i18n 前缀 */
  i18nPrefix?: string;
  /** 外部控制展开状态（v-model:open，供搜索过滤场景使用） */
  open?: boolean;
  /** 唯一标识，用于搜索过滤 */
  sectionId?: string;
  /** 搜索关键词，非空时仅当标题匹配才显示 */
  searchQuery?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "standard",
  titleKey: undefined,
  icon: undefined,
  i18nPrefix: "settings.notationSettings",
  open: undefined,
  sectionId: undefined,
  searchQuery: "",
});

const emit = defineEmits<{
  (e: "update", key: string, value: boolean | number | string | null): void;
  (e: "update:open", value: boolean): void;
}>();

const fields = computed(() => notationFieldSchemas[props.group]);

const groupIcons: Record<NotationGroupKey, IconName> = {
  display: "eye",
  layout: "layout",
  style: "palette",
};

const titleKey = computed(
  () =>
    props.titleKey ??
    `settings.notationSettings.${notationGroupTitleKeys[props.group]}`,
);

const resolvedIcon = computed(() => props.icon ?? groupIcons[props.group]);

function forwardUpdate(key: string, value: boolean | number | string | null) {
  emit("update", key, value);
}
</script>
