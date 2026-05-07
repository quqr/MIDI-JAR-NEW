<template>
  <SettingsSection
    :on-reset="() => settingsStore.resetSetting('circleOfFifths')"
  >
    <SettingsCollapse
      :title="t('settings.circleOfFifthsSettings.displayOptions')"
      icon="eye"
      :default-open="true"
    >
      <SettingsToggle
        :model-value="settingsStore.settings.circleOfFifths.displayMajor"
        :label="t('settings.circleOfFifthsSettings.displayMajor')"
        :description="t('settings.circleOfFifthsSettings.displayMajorHint')"
        @update:model-value="
          settingsStore.updateSetting('circleOfFifths.displayMajor', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.circleOfFifths.displayMinor"
        :label="t('settings.circleOfFifthsSettings.displayMinor')"
        :description="t('settings.circleOfFifthsSettings.displayMinorHint')"
        @update:model-value="
          settingsStore.updateSetting('circleOfFifths.displayMinor', $event)
        "
      />
      <SettingsSelect
        :model-value="settingsStore.settings.circleOfFifths.scale"
        :label="t('settings.circleOfFifthsSettings.mainScale')"
        :options="scaleOptions"
        :description="t('settings.circleOfFifthsSettings.mainScaleHint')"
        :disabled="
          !(
            settingsStore.settings.circleOfFifths.displayMajor &&
            settingsStore.settings.circleOfFifths.displayMinor
          )
        "
        @update:model-value="
          settingsStore.updateSetting('circleOfFifths.scale', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.circleOfFifths.displayDiminished"
        :label="t('settings.circleOfFifthsSettings.displayDiminished')"
        :description="
          t('settings.circleOfFifthsSettings.displayDiminishedHint')
        "
        @update:model-value="
          settingsStore.updateSetting(
            'circleOfFifths.displayDiminished',
            $event,
          )
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.circleOfFifths.displayDominants"
        :label="t('settings.circleOfFifthsSettings.displayDominantChords')"
        :description="
          t('settings.circleOfFifthsSettings.displayDominantChordsHint')
        "
        @update:model-value="
          settingsStore.updateSetting('circleOfFifths.displayDominants', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.circleOfFifths.displaySuspended"
        :label="t('settings.circleOfFifthsSettings.displaySuspendedChords')"
        :description="
          t('settings.circleOfFifthsSettings.displaySuspendedChordsHint')
        "
        @update:model-value="
          settingsStore.updateSetting('circleOfFifths.displaySuspended', $event)
        "
      />
    </SettingsCollapse>

    <SettingsCollapse
      :title="t('settings.circleOfFifthsSettings.advancedOptions')"
      icon="sliders"
      :default-open="true"
    >
      <SettingsToggle
        :model-value="settingsStore.settings.circleOfFifths.displayAlterations"
        :label="t('settings.circleOfFifthsSettings.displayAlterations')"
        :description="
          t('settings.circleOfFifthsSettings.displayAlterationsHint')
        "
        @update:model-value="
          settingsStore.updateSetting(
            'circleOfFifths.displayAlterations',
            $event,
          )
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.circleOfFifths.displayModes"
        :label="t('settings.circleOfFifthsSettings.displayModes')"
        :description="t('settings.circleOfFifthsSettings.displayModesHint')"
        @update:model-value="
          settingsStore.updateSetting('circleOfFifths.displayModes', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.circleOfFifths.displayDegrees"
        :label="t('settings.circleOfFifthsSettings.displayDegrees')"
        :description="t('settings.circleOfFifthsSettings.displayDegreesHint')"
        @update:model-value="
          settingsStore.updateSetting('circleOfFifths.displayDegrees', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.circleOfFifths.displayDegreeLabels"
        :label="t('settings.circleOfFifthsSettings.displayDegreeLabels')"
        :description="
          t('settings.circleOfFifthsSettings.displayDegreeLabelsHint')
        "
        @update:model-value="
          settingsStore.updateSetting(
            'circleOfFifths.displayDegreeLabels',
            $event,
          )
        "
      />
      <SettingsSelect
        :model-value="settingsStore.settings.circleOfFifths.highlightSector"
        :label="t('settings.circleOfFifthsSettings.highlightSectors')"
        :options="highlightSectorOptions"
        :description="t('settings.circleOfFifthsSettings.highlightSectorsHint')"
        @update:model-value="
          settingsStore.updateSetting('circleOfFifths.highlightSector', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.circleOfFifths.highlightInScale"
        :label="t('settings.circleOfFifthsSettings.highlightSectorsInKey')"
        :description="
          t('settings.circleOfFifthsSettings.highlightSectorsInKeyHint')
        "
        @update:model-value="
          settingsStore.updateSetting('circleOfFifths.highlightInScale', $event)
        "
      />
    </SettingsCollapse>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import {
  SettingsCollapse,
  SettingsToggle,
  SettingsSelect,
  SettingsSection,
} from "@/components/Settings";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const scaleOptions = computed(() => [
  {
    label: t("settings.circleOfFifthsSettings.scaleOptions.major"),
    value: "major",
  },
  {
    label: t("settings.circleOfFifthsSettings.scaleOptions.minor"),
    value: "minor",
  },
]);

const highlightSectorOptions = computed(() => [
  {
    label: t("settings.circleOfFifthsSettings.highlightSectorOptions.onChord"),
    value: "chord",
  },
  {
    label: t("settings.circleOfFifthsSettings.highlightSectorOptions.onNotes"),
    value: "notes",
  },
]);
</script>
