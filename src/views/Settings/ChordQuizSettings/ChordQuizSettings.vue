<template>
  <SettingsSection :on-reset="() => settingsStore.resetSetting('chordQuiz')">
    <SettingsCollapse
      :title="t('settings.chordQuizSettings.gameSettings')"
      icon="gamepad"
      :default-open="true"
    >
      <SettingsSelect
        :model-value="settingsStore.settings.chordQuiz.mode"
        :label="t('settings.chordQuizSettings.mode')"
        :options="modeOptions"
        :description="t('settings.chordQuizSettings.modeHint')"
        @update:model-value="
          settingsStore.updateSetting('chordQuiz.mode', $event)
        "
      />
      <SettingsSelect
        :model-value="String(settingsStore.settings.chordQuiz.difficulty)"
        :label="t('settings.chordQuizSettings.difficulty')"
        :options="difficultyOptions"
        :description="t('settings.chordQuizSettings.difficultyHint')"
        @update:model-value="
          settingsStore.updateSetting('chordQuiz.difficulty', Number($event))
        "
      />
      <div class="flex flex-wrap items-center gap-1 mt-2">
        <span
          v-if="settingsStore.settings.chordQuiz.difficulty > 0"
          class="badge badge-outline badge-sm"
        >
          {{ t("settings.chordQuizSettings.previousLevel") }}
        </span>
        <span
          v-for="chord in chordsByComplexity[
            settingsStore.settings.chordQuiz.difficulty
          ] ?? []"
          :key="chord"
          class="badge badge-outline badge-sm"
        >
          {{ chord }}
        </span>
      </div>
      <SettingsRange
        :model-value="settingsStore.settings.chordQuiz.gameLength"
        :label="t('settings.chordQuizSettings.gameLength')"
        :description="t('settings.chordQuizSettings.gameLengthHint')"
        :min="4"
        :max="32"
        :step="4"
        @update:model-value="
          settingsStore.updateSetting('chordQuiz.gameLength', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.chordQuiz.gamification"
        :label="t('settings.chordQuizSettings.gamification')"
        :description="t('settings.chordQuizSettings.gamificationHint')"
        @update:model-value="
          settingsStore.updateSetting('chordQuiz.gamification', $event)
        "
      />
    </SettingsCollapse>

    <SettingsCollapse
      :title="t('settings.chordQuizSettings.displayOptions')"
      icon="eye"
      :default-open="true"
    >
      <SettingsSelect
        :model-value="settingsStore.settings.chordQuiz.chordNotation"
        :label="t('settings.chordQuizSettings.chordNotation')"
        :options="chordNotationOptions"
        :description="t('settings.chordQuizSettings.chordNotationHint')"
        @update:model-value="
          settingsStore.updateSetting('chordQuiz.chordNotation', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.chordQuiz.displayReaction"
        :label="t('settings.chordQuizSettings.displayReaction')"
        :description="t('settings.chordQuizSettings.displayReactionHint')"
        @update:model-value="
          settingsStore.updateSetting('chordQuiz.displayReaction', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.chordQuiz.displayName"
        :label="t('settings.chordQuizSettings.displayChordName')"
        :description="t('settings.chordQuizSettings.displayChordNameHint')"
        @update:model-value="
          settingsStore.updateSetting('chordQuiz.displayName', $event)
        "
      />
      <SettingsToggle
        :model-value="settingsStore.settings.chordQuiz.displayIntervals"
        :label="t('settings.chordQuizSettings.displayIntervals')"
        :description="t('settings.chordQuizSettings.displayIntervalsHint')"
        @update:model-value="
          settingsStore.updateSetting('chordQuiz.displayIntervals', $event)
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
  SettingsRange,
  SettingsSection,
} from "@/components/Settings";
import { chordsByComplexity } from "./constants";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const modeOptions = computed(() => [
  {
    label: t("settings.chordQuizSettings.modeOptions.random"),
    value: "random",
  },
  {
    label: t("settings.chordQuizSettings.modeOptions.randomInKey"),
    value: "randomInKey",
  },
]);

const difficultyOptions = computed(() => [
  {
    label: t("settings.chordQuizSettings.difficultyOptions.veryEasy"),
    value: "0",
  },
  { label: t("settings.chordQuizSettings.difficultyOptions.easy"), value: "1" },
  {
    label: t("settings.chordQuizSettings.difficultyOptions.medium"),
    value: "2",
  },
  { label: t("settings.chordQuizSettings.difficultyOptions.hard"), value: "3" },
  {
    label: t("settings.chordQuizSettings.difficultyOptions.veryHard"),
    value: "4",
  },
  {
    label: t("settings.chordQuizSettings.difficultyOptions.allChords"),
    value: "5",
  },
]);

const chordNotationOptions = computed(() => [
  { label: t("settings.notationOptions.long"), value: "long" },
  { label: t("settings.notationOptions.short"), value: "short" },
  { label: t("settings.notationOptions.symbol"), value: "symbol" },
  { label: t("settings.notationOptions.preferred"), value: "preferred" },
]);
</script>
