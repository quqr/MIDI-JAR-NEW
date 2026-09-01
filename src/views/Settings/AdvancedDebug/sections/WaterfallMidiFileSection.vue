<template>
  <SettingsFieldGroup
    :fields="waterfallMidiFileDebugGroup.fields"
    :model="midiFile as unknown as SettingsFieldModel"
    :title-key="waterfallMidiFileDebugGroup.titleKey"
    :icon="waterfallMidiFileDebugGroup.icon"
    i18n-prefix="advancedDebug.waterfall.midiFile"
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
import { waterfallMidiFileDebugGroup } from "@/views/WaterfallPiano/settingsSchema";

interface MidiFileSettings {
  rightHandTrackIdx: number;
  leftHandTrackIdx: number;
}

interface Props {
  midiFile: MidiFileSettings;
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
  (e: "updateMidiFile", key: string, value: unknown): void;
  (e: "update:open", value: boolean): void;
}>();

function onUpdate(key: string, value: boolean | number | string | null): void {
  emit("updateMidiFile", key, value);
}
</script>
