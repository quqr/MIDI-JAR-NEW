<template>
  <SettingsSection :on-reset="() => settingsStore.resetSetting('piano')">
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsCollapse
        :title="t('settings.pianoSettings.range')"
        icon="piano"
        :default-open="true"
      >
        <SettingsSelect
          :model-value="settingsStore.settings.piano.from"
          :label="t('settings.pianoSettings.from')"
          :options="noteOptions"
          @update:model-value="
            settingsStore.updateSetting('piano.from', $event)
          "
        />
        <SettingsSelect
          :model-value="settingsStore.settings.piano.to"
          :label="t('settings.pianoSettings.to')"
          :options="noteOptions"
          @update:model-value="settingsStore.updateSetting('piano.to', $event)"
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.pianoSettings.labels')"
        icon="music"
        :default-open="true"
      >
        <SettingsSelect
          :model-value="settingsStore.settings.piano.label"
          :label="t('settings.pianoSettings.labelMode')"
          :options="labelOptions"
          @update:model-value="
            settingsStore.updateSetting('piano.label', $event)
          "
        />
        <SettingsSelect
          :model-value="settingsStore.settings.piano.keyName"
          :label="t('settings.pianoSettings.keyNameMode')"
          :options="keyNameOptions"
          @update:model-value="
            settingsStore.updateSetting('piano.keyName', $event)
          "
        />
        <SettingsToggle
          :model-value="settingsStore.settings.piano.showNoteNames"
          :label="t('settings.pianoSettings.showNoteNames')"
          @update:model-value="
            settingsStore.updateSetting('piano.showNoteNames', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.pianoSettings.colors')"
        icon="palette"
        :default-open="true"
      >
        <SettingsToggle
          :model-value="settingsStore.settings.piano.useThemeColors"
          :label="t('settings.pianoSettings.useThemeColors')"
          @update:model-value="
            settingsStore.updateSetting('piano.useThemeColors', $event)
          "
        />
        <SettingsRange
          :model-value="settingsStore.settings.piano.gradientIntensity"
          :label="t('settings.pianoSettings.gradientIntensity')"
          :min="0"
          :max="0.5"
          :step="0.01"
          :disabled="!settingsStore.settings.piano.useThemeColors"
          @update:model-value="
            settingsStore.updateSetting('piano.gradientIntensity', $event)
          "
        />
        <SettingsColorPicker
          v-if="!settingsStore.settings.piano.useThemeColors"
          :model-value="settingsStore.settings.piano.whiteKeyColor"
          :label="t('settings.pianoSettings.whiteKeyColor')"
          @update:model-value="
            settingsStore.updateSetting('piano.whiteKeyColor', $event)
          "
        />
        <SettingsColorPicker
          v-if="!settingsStore.settings.piano.useThemeColors"
          :model-value="settingsStore.settings.piano.blackKeyColor"
          :label="t('settings.pianoSettings.blackKeyColor')"
          @update:model-value="
            settingsStore.updateSetting('piano.blackKeyColor', $event)
          "
        />
        <SettingsColorPicker
          v-if="!settingsStore.settings.piano.useThemeColors"
          :model-value="settingsStore.settings.piano.pressedKeyColor"
          :label="t('settings.pianoSettings.pressedKeyColor')"
          @update:model-value="
            settingsStore.updateSetting('piano.pressedKeyColor', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.pianoSettings.appearance')"
        icon="cog"
        :default-open="true"
      >
        <SettingsRange
          :model-value="settingsStore.settings.piano.keyCornerRadius"
          :label="t('settings.pianoSettings.keyCornerRadius')"
          :min="0"
          :max="5"
          :step="0.1"
          @update:model-value="
            settingsStore.updateSetting('piano.keyCornerRadius', $event)
          "
        />
      </SettingsCollapse>
    </div>
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
  SettingsRange,
  SettingsColorPicker,
  SettingsSection,
} from "@/components/Settings";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const noteOptions = computed(() => {
  const notes = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const options: { label: string; value: string }[] = [];
  for (let oct = 0; oct <= 8; oct++) {
    for (const note of notes) {
      const name = `${note}${oct}`;
      options.push({ label: name, value: name });
      if (oct === 8 && note === "C") break; // C8 is the last key
    }
  }
  return options;
});

const labelOptions = computed(() => [
  { label: t("settings.pianoSettings.labelNone"), value: "none" },
  { label: t("settings.pianoSettings.labelPitchClass"), value: "pitchClass" },
  { label: t("settings.pianoSettings.labelNote"), value: "note" },
  { label: t("settings.pianoSettings.labelChordNote"), value: "chordNote" },
  { label: t("settings.pianoSettings.labelInterval"), value: "interval" },
]);

const keyNameOptions = computed(() => [
  { label: t("settings.pianoSettings.keyNameNone"), value: "none" },
  { label: t("settings.pianoSettings.keyNameOctave"), value: "octave" },
  { label: t("settings.pianoSettings.keyNamePitchClass"), value: "pitchClass" },
  { label: t("settings.pianoSettings.keyNameNote"), value: "note" },
]);
</script>
