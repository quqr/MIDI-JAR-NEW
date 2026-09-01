<template>
  <div class="flex flex-col gap-1">
    <SettingsSelect
      :model-value="appearance.musicFont"
      :label="t('scoreScroll.appearance.musicFont')"
      :options="fontOptions"
      @update:model-value="
        (v) => store.updateAppearance('musicFont', v as ScoreMusicFont)
      "
    />
    <SettingsSelect
      :model-value="appearance.background"
      :label="t('scoreScroll.appearance.background')"
      :options="backgroundOptions"
      @update:model-value="
        (v) => store.updateAppearance('background', v as ScoreBackgroundStyle)
      "
    />
  </div>
</template>

<script setup lang="ts">
/** 外观设置面板：音乐字体 / 主题 / 背景 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingsSelect from "@/components/Settings/SettingsSelect.vue";
import { useScoreScrollStore } from "../stores/ScoreScroll";
import { MUSIC_FONTS, BACKGROUND_STYLES } from "../constants";
import type { ScoreBackgroundStyle, ScoreMusicFont } from "../types";

const { t } = useI18n();
const store = useScoreScrollStore();

const appearance = computed(() => store.settings.appearance);

const fontOptions = MUSIC_FONTS.map((f) => ({
  value: f.value,
  label: f.label,
}));

const backgroundOptions = computed(() =>
  BACKGROUND_STYLES.map((b) => ({
    value: b.value,
    label: t(b.label),
  })),
);
</script>
