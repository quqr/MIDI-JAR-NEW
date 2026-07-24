<template>
  <SettingsCollapse
    v-if="isVisible"
    :title="t('advancedDebug.waterfall.midiFile.title')"
    icon="file-music"
    :open="isOpen"
    :section-id="sectionId"
    @update:open="$emit('update:open', $event)"
  >
    <div class="py-2.5">
      <div class="text-hig-sm font-medium mb-1">
        {{ t("advancedDebug.waterfall.midiFile.selectedTracks") }}
      </div>
      <div class="text-hig-xs text-base-content/70 mb-2">
        {{ t("advancedDebug.waterfall.midiFile.selectedTracksHint") }}
      </div>
      <div v-if="midiFile.selectedTracks.length" class="flex flex-wrap gap-1">
        <span
          v-for="track in midiFile.selectedTracks"
          :key="track"
          class="badge badge-sm badge-outline"
          >{{ track }}</span
        >
      </div>
      <div v-else class="text-hig-xs text-base-content/70">
        {{ t("advancedDebug.waterfall.midiFile.noTracks") }}
      </div>
    </div>
    <div class="py-2.5">
      <div class="text-hig-sm font-medium mb-2">
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
    <SettingsRange
      :model-value="midiFile.rightHandTrackIdx"
      :label="t('advancedDebug.waterfall.midiFile.rightHandTrackIdx')"
      :description="t('advancedDebug.waterfall.midiFile.rightHandTrackIdxHint')"
      :min="0"
      :max="15"
      :step="1"
      @update:model-value="emit('updateMidiFile', 'rightHandTrackIdx', $event)"
    />
    <SettingsRange
      :model-value="midiFile.leftHandTrackIdx"
      :label="t('advancedDebug.waterfall.midiFile.leftHandTrackIdx')"
      :description="t('advancedDebug.waterfall.midiFile.leftHandTrackIdxHint')"
      :min="0"
      :max="15"
      :step="1"
      @update:model-value="emit('updateMidiFile', 'leftHandTrackIdx', $event)"
    />
  </SettingsCollapse>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  SettingsCollapse,
  SettingsColorPicker,
  SettingsRange,
} from "@/components/Settings";

interface MidiFileSettings {
  selectedTracks: number[];
  trackColors: string[];
  rightHandTrackIdx: number;
  leftHandTrackIdx: number;
}

interface Props {
  midiFile: MidiFileSettings;
  open?: boolean;
  sectionId?: string;
  searchQuery?: string;
}

const props = withDefaults(defineProps<Props>(), {
  open: undefined,
  sectionId: undefined,
  searchQuery: "",
});

const emit = defineEmits<{
  (e: "updateTrackColor", index: number, color: string | null): void;
  (e: "updateMidiFile", key: string, value: unknown): void;
  (e: "update:open", value: boolean): void;
}>();

const { t } = useI18n();

const isVisible = computed(() => {
  const q = props.searchQuery.trim().toLowerCase();
  if (!q) return true;
  return t("advancedDebug.waterfall.midiFile.title").toLowerCase().includes(q);
});

const isOpen = computed(() => {
  if (props.searchQuery.trim()) return true;
  return props.open;
});
</script>
