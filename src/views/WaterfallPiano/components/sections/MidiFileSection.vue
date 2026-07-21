<template>
  <SettingsCollapse :title="t('WaterfallPiano.midiFile')" :default-open="false">
    <SettingsRange
      :model-value="settings.playbackSpeed"
      :label="t('WaterfallPiano.playbackSpeed')"
      :min="PLAYBACK_SPEED.min"
      :max="PLAYBACK_SPEED.max"
      :step="PLAYBACK_SPEED.step"
      @update:model-value="emit('update', 'playbackSpeed', $event)"
    />
    <SettingsToggle
      :model-value="settings.loop"
      :label="t('WaterfallPiano.loop')"
      @update:model-value="emit('update', 'loop', $event)"
    />
    <SettingsToggle
      :model-value="settings.showNoteNames"
      :label="t('WaterfallPiano.showNoteNames')"
      @update:model-value="emit('update', 'showNoteNames', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import {
  SettingsCollapse,
  SettingsToggle,
  SettingsRange,
} from "@/components/Settings";
import { PLAYBACK_SPEED } from "../../constants";
import type { MidiFileConfig } from "../../types";

defineProps<{
  settings: MidiFileConfig;
}>();

const emit = defineEmits<{
  (e: "update", key: keyof MidiFileConfig, value: unknown): void;
}>();

const { t } = useI18n();
</script>
