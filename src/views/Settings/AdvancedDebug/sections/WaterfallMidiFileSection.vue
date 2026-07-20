<template>
  <SettingsCollapse
    :title="t('advancedDebug.waterfall.midiFile.title')"
    icon="file-music"
    :default-open="false"
  >
    <div class="py-2.5">
      <div class="text-sm font-medium mb-1">
        {{ t("advancedDebug.waterfall.midiFile.selectedTracks") }}
      </div>
      <div class="text-xs text-base-content/60 mb-2">
        {{ t("advancedDebug.waterfall.midiFile.selectedTracksHint") }}
      </div>
      <div
        v-if="midiFile.selectedTracks.length"
        class="flex flex-wrap gap-1"
      >
        <span
          v-for="track in midiFile.selectedTracks"
          :key="track"
          class="badge badge-sm badge-outline"
          >{{ track }}</span
        >
      </div>
      <div v-else class="text-xs text-base-content/40">
        {{ t("advancedDebug.waterfall.midiFile.noTracks") }}
      </div>
    </div>
    <div class="py-2.5">
      <div class="text-sm font-medium mb-2">
        {{ t("advancedDebug.waterfall.midiFile.trackColors") }}
      </div>
      <div class="space-y-1">
        <SettingsColorPicker
          v-for="(color, idx) in midiFile.trackColors"
          :key="idx"
          :model-value="color"
          :label="
            t('advancedDebug.waterfall.midiFile.trackColorN', {
              n: idx + 1,
            })
          "
          @update:model-value="emit('updateTrackColor', idx, $event)"
        />
      </div>
    </div>
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { SettingsCollapse, SettingsColorPicker } from "@/components/Settings";

interface MidiFileSettings {
  selectedTracks: number[];
  trackColors: string[];
}

defineProps<{
  midiFile: MidiFileSettings;
}>();

const emit = defineEmits<{
  (e: "updateTrackColor", index: number, color: string | null): void;
}>();

const { t } = useI18n();
</script>
