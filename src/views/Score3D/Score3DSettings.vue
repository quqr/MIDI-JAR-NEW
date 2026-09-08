<template>
  <div class="flex flex-col gap-1">
    <SettingsColorPicker
      :model-value="store.backgroundColor"
      :label="t('score3d.settings.background')"
      @update:model-value="(v) => store.setBackgroundColor(v)"
    />
  </div>
</template>

<script setup lang="ts">
/** 三维乐谱设置：场景背景颜色 */
import { useI18n } from "vue-i18n";
import SettingsColorPicker from "@/components/Settings/SettingsColorPicker.vue";
import { useScore3dStore } from "./stores/Score3D";

const { t } = useI18n();
const store = useScore3dStore();
</script>
