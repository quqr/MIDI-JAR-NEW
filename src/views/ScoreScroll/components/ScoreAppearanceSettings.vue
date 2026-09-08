<template>
  <div class="flex flex-col gap-1">
    <SettingsSelect
      :model-value="appearance.background"
      :label="t('scoreScroll.appearance.background')"
      :options="backgroundOptions"
      @update:model-value="
        (v) => store.updateAppearance('background', v as ScoreBackgroundStyle)
      "
    />
    <SettingsColorPicker
      v-if="appearance.background === 'custom'"
      :model-value="appearance.customColor"
      :label="t('scoreScroll.appearance.customColor')"
      @update:model-value="(v) => store.updateAppearance('customColor', v)"
    />
  </div>
</template>

<script setup lang="ts">
/** 外观设置面板：背景（主题/纸张/自定义纯色 + 自选颜色） */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingsSelect from "@/components/Settings/SettingsSelect.vue";
import SettingsColorPicker from "@/components/Settings/SettingsColorPicker.vue";
import { useScoreScrollStore } from "../stores/ScoreScroll";
import { BACKGROUND_STYLES } from "../constants";
import type { ScoreBackgroundStyle } from "../types";

const { t } = useI18n();
const store = useScoreScrollStore();

const appearance = computed(() => store.settings.appearance);

const backgroundOptions = computed(() =>
  BACKGROUND_STYLES.map((b) => ({
    value: b.value,
    label: t(b.label),
  })),
);
</script>
