<template>
  <SettingsSection :on-reset="resetModule">
    <div class="grid grid-cols-1 gap-4 m-4">
      <SettingsCollapse
        :title="t('settings.chordDisplaySettings.chords')"
        icon="music-note"
        :default-open="true"
      >
        <SettingsToggle
          :model-value="moduleSettings.displayChord"
          :label="t('settings.chordDisplaySettings.displayChord')"
          :description="t('settings.chordDisplaySettings.displayChordHint')"
          @update:model-value="updateSetting('displayChord', $event)"
        />
        <SettingsToggle
          :model-value="moduleSettings.displayAltChords"
          :label="t('settings.chordDisplaySettings.displayAltChords')"
          :description="t('settings.chordDisplaySettings.displayAltChordsHint')"
          @update:model-value="updateSetting('displayAltChords', $event)"
        />
        <SettingsToggle
          :model-value="moduleSettings.displayName"
          :label="t('settings.chordDisplaySettings.displayChordName')"
          :description="t('settings.chordDisplaySettings.displayChordNameHint')"
          @update:model-value="updateSetting('displayName', $event)"
        />
        <SettingsSelect
          :model-value="moduleSettings.chordNotation"
          :label="t('settings.chordDisplaySettings.chordNotation')"
          :options="chordNotationOptions"
          :description="t('settings.chordDisplaySettings.chordNotationHint')"
          @update:model-value="updateSetting('chordNotation', $event)"
        />
        <SettingsToggle
          :model-value="moduleSettings.highlightAlterations"
          :label="t('settings.chordDisplaySettings.highlightAlterations')"
          :description="
            t('settings.chordDisplaySettings.highlightAlterationsHint')
          "
          @update:model-value="updateSetting('highlightAlterations', $event)"
        />
        <SettingsToggle
          :model-value="moduleSettings.allowOmissions"
          :label="t('settings.chordDisplaySettings.allowOmissions')"
          :description="t('settings.chordDisplaySettings.allowOmissionsHint')"
          @update:model-value="updateSetting('allowOmissions', $event)"
        />
        <SettingsToggle
          :model-value="moduleSettings.useSustain"
          :label="t('settings.chordDisplaySettings.useSustainPedal')"
          :description="t('settings.chordDisplaySettings.useSustainPedalHint')"
          @update:model-value="updateSetting('useSustain', $event)"
        />
        <SettingsToggle
          :model-value="moduleSettings.detectOnRelease"
          :label="t('settings.chordDisplaySettings.detectOnRelease')"
          :description="t('settings.chordDisplaySettings.detectOnReleaseHint')"
          @update:model-value="updateSetting('detectOnRelease', $event)"
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.chordDisplaySettings.additionalInfo')"
        icon="info"
        :default-open="true"
      >
        <SettingsToggle
          :model-value="moduleSettings.displayNotation"
          :label="t('settings.chordDisplaySettings.displayNotation')"
          :description="t('settings.chordDisplaySettings.displayNotationHint')"
          @update:model-value="updateSetting('displayNotation', $event)"
        />
        <SettingsToggle
          :model-value="moduleSettings.displayIntervals"
          :label="t('settings.chordDisplaySettings.displayIntervals')"
          :description="t('settings.chordDisplaySettings.displayIntervalsHint')"
          @update:model-value="updateSetting('displayIntervals', $event)"
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.chordDisplaySettings.keyboard')"
        icon="keyboard"
        :default-open="true"
      >
        <SettingsToggle
          :model-value="moduleSettings.displayKeyboard"
          :label="t('settings.chordDisplaySettings.displayKeyboard')"
          :description="t('settings.chordDisplaySettings.displayKeyboardHint')"
          @update:model-value="updateSetting('displayKeyboard', $event)"
        />
        <SettingsTextInput
          :model-value="moduleSettings.keyboard.from"
          :label="t('settings.chordDisplaySettings.noteStart')"
          :description="t('settings.chordDisplaySettings.noteStartHint')"
          @update:model-value="updateNestedSetting('keyboard.from', $event)"
        />
        <SettingsTextInput
          :model-value="moduleSettings.keyboard.to"
          :label="t('settings.chordDisplaySettings.noteEnd')"
          :description="t('settings.chordDisplaySettings.noteEndHint')"
          @update:model-value="updateNestedSetting('keyboard.to', $event)"
        />
        <SettingsToggle
          :model-value="moduleSettings.keyboard.wrap"
          :label="t('settings.chordDisplaySettings.wrapKeyboard')"
          :description="t('settings.chordDisplaySettings.wrapKeyboardHint')"
          @update:model-value="updateNestedSetting('keyboard.wrap', $event)"
        />
        <SettingsToggle
          :model-value="moduleSettings.keyboard.displaySustained"
          :label="t('settings.chordDisplaySettings.displaySustainedNotes')"
          :description="
            t('settings.chordDisplaySettings.displaySustainedNotesHint')
          "
          @update:model-value="
            updateNestedSetting('keyboard.displaySustained', $event)
          "
        />
        <SettingsSelect
          :model-value="moduleSettings.keyboard.keyName"
          :label="t('settings.chordDisplaySettings.keyNames')"
          :options="keyNameOptions"
          :description="t('settings.chordDisplaySettings.keyNamesHint')"
          @update:model-value="updateNestedSetting('keyboard.keyName', $event)"
        />
        <SettingsSelect
          :model-value="moduleSettings.keyboard.keyInfo"
          :label="t('settings.chordDisplaySettings.playedKeyInfo')"
          :options="keyInfoOptions"
          :description="t('settings.chordDisplaySettings.playedKeyInfoHint')"
          @update:model-value="updateNestedSetting('keyboard.keyInfo', $event)"
        />
        <SettingsSelect
          :model-value="moduleSettings.keyboard.label"
          :label="t('settings.chordDisplaySettings.playedKeyLabel')"
          :options="labelOptions"
          :description="t('settings.chordDisplaySettings.playedKeyLabelHint')"
          @update:model-value="updateNestedSetting('keyboard.label', $event)"
        />
        <SettingsRange
          :model-value="moduleSettings.keyboard.fadeOutDuration"
          :label="t('settings.chordDisplaySettings.fadeOutDuration')"
          :description="t('settings.chordDisplaySettings.fadeOutDurationHint')"
          :min="0"
          :max="1"
          :step="0.1"
          @update:model-value="
            updateNestedSetting('keyboard.fadeOutDuration', $event)
          "
        />
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.chordDisplaySettings.keyboardSkin')"
        icon="palette"
        :default-open="true"
      >
        <SettingsSelect
          :model-value="moduleSettings.keyboard.skin"
          :label="t('settings.chordDisplaySettings.skin')"
          :options="skinOptions"
          :description="t('settings.chordDisplaySettings.skinHint')"
          @update:model-value="updateNestedSetting('keyboard.skin', $event)"
        />
        <SettingsRange
          :model-value="moduleSettings.keyboard.textOpacity"
          :label="t('settings.chordDisplaySettings.textOpacity')"
          :description="t('settings.chordDisplaySettings.textOpacityHint')"
          :min="0"
          :max="1"
          :step="0.1"
          @update:model-value="
            updateNestedSetting('keyboard.textOpacity', $event)
          "
        />
        <SettingsRange
          :model-value="moduleSettings.keyboard.sizes.height"
          :label="t('settings.chordDisplaySettings.keyHeight')"
          :description="t('settings.chordDisplaySettings.keyHeightHint')"
          :min="1"
          :max="16"
          :step="0.1"
          @update:model-value="
            updateNestedSetting('keyboard.sizes.height', $event)
          "
        />
        <template v-if="moduleSettings.keyboard.skin === 'classic'">
          <SettingsRange
            :model-value="moduleSettings.keyboard.sizes.ratio"
            :label="t('settings.chordDisplaySettings.blackKeyRatio')"
            :description="t('settings.chordDisplaySettings.blackKeyRatioHint')"
            :min="0.1"
            :max="0.9"
            :step="0.025"
            @update:model-value="
              updateNestedSetting('keyboard.sizes.ratio', $event)
            "
          />
          <SettingsRange
            :model-value="moduleSettings.keyboard.sizes.radius"
            :label="t('settings.chordDisplaySettings.keyBorderRadius')"
            :min="0"
            :max="1"
            :step="0.05"
            @update:model-value="
              updateNestedSetting('keyboard.sizes.radius', $event)
            "
          />
          <SettingsToggle
            :model-value="moduleSettings.keyboard.sizes.bevel"
            :label="t('settings.chordDisplaySettings.keyBevel')"
            :description="t('settings.chordDisplaySettings.keyBevelHint')"
            @update:model-value="
              updateNestedSetting('keyboard.sizes.bevel', $event)
            "
          />
        </template>
      </SettingsCollapse>

      <SettingsCollapse
        :title="t('settings.chordDisplaySettings.keyboardColors')"
        icon="palette"
        :default-open="true"
      >
        <SettingsColorPicker
          :model-value="moduleSettings.keyboard.colors.black"
          :label="t('settings.chordDisplaySettings.blackKeys')"
          @update:model-value="
            updateNestedSetting('keyboard.colors.black', $event)
          "
        />
        <SettingsColorPicker
          :model-value="moduleSettings.keyboard.colors.white"
          :label="t('settings.chordDisplaySettings.whiteKeys')"
          @update:model-value="
            updateNestedSetting('keyboard.colors.white', $event)
          "
        />
        <SettingsColorPicker
          :model-value="moduleSettings.keyboard.colors.played"
          :label="t('settings.chordDisplaySettings.playedKeys')"
          @update:model-value="
            updateNestedSetting('keyboard.colors.played', $event)
          "
        />
        <SettingsColorPicker
          :model-value="moduleSettings.keyboard.colors.wrapped"
          :label="t('settings.chordDisplaySettings.wrappedKeys')"
          @update:model-value="
            updateNestedSetting('keyboard.colors.wrapped', $event)
          "
        />
        <SettingsColorPicker
          :model-value="moduleSettings.keyboard.colors.sustained"
          :label="t('settings.chordDisplaySettings.sustainedKeys')"
          @update:model-value="
            updateNestedSetting('keyboard.colors.sustained', $event)
          "
        />
      </SettingsCollapse>

      <NotationLayoutSettings />

      <NotationStyleSettings />
    </div>
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";
import { defaultChordDisplaySettings, ChordDisplaySettings } from "@/types";
import {
  SettingsCollapse,
  SettingsToggle,
  SettingsSelect,
  SettingsRange,
  SettingsTextInput,
  SettingsColorPicker,
  SettingsSection,
} from "@/components/Settings";
import { fields } from "./utils";
import NotationLayoutSettings from "@/components/Notation/NotationLayoutSettings.vue";
import NotationStyleSettings from "@/components/Notation/NotationStyleSettings.vue";
import { setValueByPath } from "@/helpers";

const { t } = useI18n();
const route = useRoute();
const settingsStore = useSettingsStore();

const props = withDefaults(
  defineProps<{
    moduleId?: string;
  }>(),
  {},
);

const routeModuleId = computed(() => route.params.moduleId as string);
const moduleId = computed(() => props.moduleId || routeModuleId.value);

const moduleSettings = computed<ChordDisplaySettings>(() => {
  const mod = settingsStore.settings.chordDisplay.find(
    (m) => m.id === moduleId.value,
  );
  return mod ?? { ...defaultChordDisplaySettings, id: moduleId.value };
});

const chordNotationOptions = fields.chordNotation.choices.map((c) => ({
  label: c.label,
  value: c.value,
}));

const skinOptions = fields.keyboard.skin.choices.map((c) => ({
  label: c.label,
  value: c.value,
}));

const keyNameOptions = fields.keyboard.keyName.choices.map((c) => ({
  label: c.label,
  value: c.value,
}));

const keyInfoOptions = fields.keyboard.keyInfo.choices.map((c) => ({
  label: c.label,
  value: c.value,
}));

const labelOptions = fields.keyboard.label.choices.map((c) => ({
  label: c.label,
  value: c.value,
}));

function updateSetting(key: string, value: any) {
  const index = settingsStore.settings.chordDisplay.findIndex(
    (m) => m.id === moduleId.value,
  );
  if (index !== -1) {
    const updated = JSON.parse(
      JSON.stringify(settingsStore.settings.chordDisplay),
    );
    setValueByPath(updated[index], key, value);
    settingsStore.settings.chordDisplay = updated;
  }
}

function updateNestedSetting(path: string, value: any) {
  const index = settingsStore.settings.chordDisplay.findIndex(
    (m) => m.id === moduleId.value,
  );
  if (index !== -1) {
    const updated = JSON.parse(
      JSON.stringify(settingsStore.settings.chordDisplay),
    );
    setValueByPath(updated[index], path, value);
    settingsStore.settings.chordDisplay = updated;
  }
}

function resetModule() {
  const index = settingsStore.settings.chordDisplay.findIndex(
    (m) => m.id === moduleId.value,
  );
  if (index !== -1) {
    const updated = [...settingsStore.settings.chordDisplay];
    updated[index] = { ...defaultChordDisplaySettings, id: moduleId.value };
    settingsStore.settings.chordDisplay = updated;
  }
}
</script>
