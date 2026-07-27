<template>
  <div class="form-control">
    <select
      v-model="keySignature"
      class="select select-bordered select-sm max-w-xs"
      :aria-label="t('settings.notationSettings.key')"
    >
      <option
        v-for="choice in keyChoices"
        :key="choice.value"
        :value="choice.value"
      >
        {{ choice.title }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSettingsStore } from "@/stores/settings";

const { t } = useI18n();
const settingsStore = useSettingsStore();

const keySignature = computed({
  get: () => settingsStore.settings.notation.key,
  set: (value: string) => settingsStore.updateSetting("notation.key", value),
});

const keyChoices = computed(() => [
  { title: t("settings.notationSettings.keySignatures.C"), value: "C" },
  { title: t("settings.notationSettings.keySignatures.G"), value: "G" },
  { title: t("settings.notationSettings.keySignatures.D"), value: "D" },
  { title: t("settings.notationSettings.keySignatures.A"), value: "A" },
  { title: t("settings.notationSettings.keySignatures.E"), value: "E" },
  { title: t("settings.notationSettings.keySignatures.B"), value: "B" },
  { title: t("settings.notationSettings.keySignatures.F#"), value: "F#" },
  { title: t("settings.notationSettings.keySignatures.Db"), value: "Db" },
  { title: t("settings.notationSettings.keySignatures.Ab"), value: "Ab" },
  { title: t("settings.notationSettings.keySignatures.Eb"), value: "Eb" },
  { title: t("settings.notationSettings.keySignatures.Bb"), value: "Bb" },
  { title: t("settings.notationSettings.keySignatures.F"), value: "F" },
]);
</script>
