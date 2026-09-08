<template>
  <div class="max-w-xs min-w-48">
    <RangeSlider
      :model-value="keyIndex"
      :min="0"
      :max="keyChoices.length - 1"
      :step="1"
      :tick-labels="keyTitles"
      hide-labels
      no-fill
      :aria-label="t('settings.notationSettings.key')"
      @update:model-value="setKey"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import RangeSlider from "@/components/common/RangeSlider.vue";
import type { RangeSliderValue } from "@/components/common/rangeSlider";
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

const keyTitles = computed(() => keyChoices.value.map((c) => c.title));
const keyIndex = computed(() =>
  Math.max(
    0,
    keyChoices.value.findIndex((c) => c.value === keySignature.value),
  ),
);

function setKey(index: RangeSliderValue) {
  const choice = keyChoices.value[Number(index)];
  if (choice) keySignature.value = choice.value;
}
</script>
