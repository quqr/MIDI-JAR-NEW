<template>
  <SettingsFieldGroup
    :fields="waterfallKeyboardDebugGroup.fields"
    :model="keyboard as unknown as SettingsFieldModel"
    :title-key="waterfallKeyboardDebugGroup.titleKey"
    :icon="waterfallKeyboardDebugGroup.icon"
    i18n-prefix="advancedDebug.waterfall.keyboard"
    :open="open"
    :section-id="sectionId"
    :search-query="searchQuery"
    @update="onUpdate"
    @update:open="$emit('update:open', $event)"
  />
</template>

<script setup lang="ts">
import { SettingsFieldGroup } from "@/components/Settings";
import type { SettingsFieldModel } from "@/components/Settings/schema";
import { waterfallKeyboardDebugGroup } from "@/views/WaterfallPiano/settingsSchema";

interface KeyboardSettings {
  range: string;
  customFrom: string;
  customTo: string;
  keyBorderWidth: number;
  keyBorderColor: string;
  separatorColor: string;
  separatorThickness: number;
  defaultVelocity: number;
}

interface Props {
  keyboard: KeyboardSettings;
  /** 外部控制展开状态（v-model:open） */
  open?: boolean;
  /** 唯一标识，用于搜索过滤 */
  sectionId?: string;
  /** 搜索关键词，非空时仅当标题匹配才显示 */
  searchQuery?: string;
}

withDefaults(defineProps<Props>(), {
  open: undefined,
  sectionId: undefined,
  searchQuery: "",
});

const emit = defineEmits<{
  (e: "updateKb", key: string, value: unknown): void;
  (e: "update:open", value: boolean): void;
}>();

function onUpdate(key: string, value: boolean | number | string | null): void {
  emit("updateKb", key, value);
}
</script>
