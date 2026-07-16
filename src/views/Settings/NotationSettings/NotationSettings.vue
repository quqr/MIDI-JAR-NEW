<template>
  <SettingsSection
    :show-reset="true"
    :on-reset="() => settingsStore.resetSetting('notation')"
  >
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsCollapse
        :title="t('settings.notationSettings.title')"
        icon="music-note"
        :default-open="true"
      >
        <div class="flex items-center justify-between py-2.5">
          <span class="text-sm">{{
            t("settings.notationSettings.keySignature")
          }}</span>
          <InputNote
            :model-value="settingsStore.settings.notation.key"
            @update:model-value="
              settingsStore.updateSetting('notation.key', $event)
            "
            learn
          />
        </div>
        <SettingsSelect
          :model-value="settingsStore.settings.notation.accidentals"
          :label="t('settings.notationSettings.accidentalsInC')"
          :options="accidentalsOptions"
          :disabled="settingsStore.settings.notation.key !== 'C'"
          @update:model-value="
            settingsStore.updateSetting('notation.accidentals', $event)
          "
        />
        <SettingsSelect
          :model-value="settingsStore.settings.notation.staffClef"
          :label="t('settings.notationSettings.staffClef')"
          :options="staffClefOptions"
          @update:model-value="
            settingsStore.updateSetting('notation.staffClef', $event)
          "
        />
        <SettingsRange
          :model-value="settingsStore.settings.notation.staffTranspose"
          :label="t('settings.notationSettings.staffTranspose')"
          :description="t('settings.notationSettings.staffTransposeHint')"
          :min="-24"
          :max="24"
          :step="1"
          @update:model-value="
            settingsStore.updateSetting('notation.staffTranspose', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.notationSettings.displayOptions')"
        icon="eye"
        :default-open="true"
      >
        <SettingsToggle
          :model-value="displayConfig.clef"
          :label="t('settings.notationSettings.showClef')"
          :description="t('settings.notationSettings.showClefHint')"
          @update:model-value="updateDisplay('clef', $event)"
        />
        <SettingsToggle
          :model-value="displayConfig.keySignature"
          :label="t('settings.notationSettings.showKeySignature')"
          :description="t('settings.notationSettings.showKeySignatureHint')"
          @update:model-value="updateDisplay('keySignature', $event)"
        />
        <SettingsToggle
          :model-value="displayConfig.keySignatureText"
          :label="t('settings.notationSettings.showKeySignatureText')"
          :description="t('settings.notationSettings.showKeySignatureTextHint')"
          @update:model-value="updateDisplay('keySignatureText', $event)"
        />
        <SettingsToggle
          :model-value="displayConfig.barlines"
          :label="t('settings.notationSettings.showBarlines')"
          :description="t('settings.notationSettings.showBarlinesHint')"
          @update:model-value="updateDisplay('barlines', $event)"
        />
        <SettingsToggle
          :model-value="displayConfig.noteNames"
          :label="t('settings.notationSettings.showNoteNames')"
          :description="t('settings.notationSettings.showNoteNamesHint')"
          @update:model-value="updateDisplay('noteNames', $event)"
        />
        <SettingsToggle
          :model-value="displayConfig.staffLines"
          :label="t('settings.notationSettings.showStaffLines')"
          :description="t('settings.notationSettings.showStaffLinesHint')"
          @update:model-value="updateDisplay('staffLines', $event)"
        />
      </SettingsCollapse>

      <NotationLayoutSettings />

      <NotationStyleSettings />
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import { InputNote } from "@/components/InputNote/";
import {
  SettingsCollapse,
  SettingsSelect,
  SettingsToggle,
  SettingsRange,
  SettingsSection,
} from "@/components/Settings";
import { mergeDisplayConfig } from "@/components/Notation/utils";
import NotationLayoutSettings from "@/components/Notation/NotationLayoutSettings.vue";
import NotationStyleSettings from "@/components/Notation/NotationStyleSettings.vue";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const accidentalsOptions = computed(() => [
  { label: t("settings.notationSettings.sharp"), value: "sharp" },
  { label: t("settings.notationSettings.flat"), value: "flat" },
]);

const staffClefOptions = computed(() => [
  { label: t("settings.notationSettings.bassTreble"), value: "both" },
  { label: t("settings.notationSettings.bass"), value: "bass" },
  { label: t("settings.notationSettings.treble"), value: "treble" },
]);

const displayConfig = computed(() =>
  mergeDisplayConfig(settingsStore.settings.notation.display),
);

function updateDisplay(key: string, value: boolean) {
  const current: Record<string, boolean> = {
    ...settingsStore.settings.notation.display,
  };
  current[key] = value;
  settingsStore.updateSetting("notation.display", current);
}
</script>
