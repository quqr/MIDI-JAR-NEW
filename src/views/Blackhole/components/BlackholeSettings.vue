<template>
  <div class="flex flex-col gap-4 p-4 overflow-y-auto h-full">
    <!-- 整体强度 -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-base-content/70">
        {{ t("blackhole.settings.general") }}
      </h3>
      <div class="flex items-center gap-3">
        <label class="text-xs text-base-content/50 w-24 shrink-0">
          {{ t("blackhole.settings.intensity") }}
        </label>
        <input
          type="range"
          class="range range-sm range-primary flex-1"
          :min="0"
          :max="1"
          :step="0.01"
          :value="config.intensity"
          @input="update('intensity', $event)"
        />
        <span class="text-xs w-10 text-right">{{ config.intensity.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 黑洞与透镜 -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-base-content/70">
        {{ t("blackhole.settings.holeAndLens") }}
      </h3>
      <div
        v-for="key in ['holeRadius', 'lensDepth', 'starGain']"
        :key="key"
        class="flex items-center gap-3"
      >
        <label class="text-xs text-base-content/50 w-24 shrink-0">
          {{ t(`blackhole.params.${key}`) }}
        </label>
        <input
          type="range"
          class="range range-sm range-primary flex-1"
          :min="ranges[key].min"
          :max="ranges[key].max"
          :step="ranges[key].step"
          :value="(config as any)[key]"
          @input="update(key, $event)"
        />
        <span class="text-xs w-10 text-right">
          {{ formatValue(key, (config as any)[key]) }}
        </span>
      </div>
    </div>

    <!-- 吸积盘几何 -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-base-content/70">
        {{ t("blackhole.settings.diskGeometry") }}
      </h3>
      <div
        v-for="key in ['diskInner', 'diskOuter', 'diskIncl', 'diskRoll']"
        :key="key"
        class="flex items-center gap-3"
      >
        <label class="text-xs text-base-content/50 w-24 shrink-0">
          {{ t(`blackhole.params.${key}`) }}
        </label>
        <input
          type="range"
          class="range range-sm range-primary flex-1"
          :min="ranges[key].min"
          :max="ranges[key].max"
          :step="ranges[key].step"
          :value="(config as any)[key]"
          @input="update(key, $event)"
        />
        <span class="text-xs w-10 text-right">
          {{ formatValue(key, (config as any)[key]) }}
        </span>
      </div>
    </div>

    <!-- 吸积盘物质与光 -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-base-content/70">
        {{ t("blackhole.settings.diskMatter") }}
      </h3>
      <div
        v-for="key in [
          'diskGain',
          'diskOpacity',
          'diskTemp',
          'dopplerMix',
          'diskBeam',
          'diskSpeed',
          'diskWind',
          'diskContrast',
        ]"
        :key="key"
        class="flex items-center gap-3"
      >
        <label class="text-xs text-base-content/50 w-24 shrink-0">
          {{ t(`blackhole.params.${key}`) }}
        </label>
        <input
          type="range"
          class="range range-sm range-primary flex-1"
          :min="ranges[key].min"
          :max="ranges[key].max"
          :step="ranges[key].step"
          :value="(config as any)[key]"
          @input="update(key, $event)"
        />
        <span class="text-xs w-10 text-right">
          {{ formatValue(key, (config as any)[key]) }}
        </span>
      </div>
    </div>

    <!-- 光照与屏幕 -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-base-content/70">
        {{ t("blackhole.settings.lightAndScreen") }}
      </h3>
      <div
        v-for="key in ['exposure', 'driftSpeed']"
        :key="key"
        class="flex items-center gap-3"
      >
        <label class="text-xs text-base-content/50 w-24 shrink-0">
          {{ t(`blackhole.params.${key}`) }}
        </label>
        <input
          type="range"
          class="range range-sm range-primary flex-1"
          :min="ranges[key].min"
          :max="ranges[key].max"
          :step="ranges[key].step"
          :value="(config as any)[key]"
          @input="update(key, $event)"
        />
        <span class="text-xs w-10 text-right">
          {{ formatValue(key, (config as any)[key]) }}
        </span>
      </div>
    </div>

    <!-- 自定义背景 -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-base-content/70">
        {{ t("blackhole.settings.background") }}
      </h3>

      <!-- 上传/移除按钮 -->
      <div class="flex gap-2">
        <label class="btn btn-sm btn-outline flex-1">
          {{ t("blackhole.background.upload") }}
          <input
            type="file"
            accept="image/*"
            class="hidden"
            @change="onBackgroundUpload"
          />
        </label>
        <button
          v-if="config.background.imageUrl"
          class="btn btn-sm btn-outline btn-error"
          @click="removeBackground"
        >
          {{ t("blackhole.background.remove") }}
        </button>
      </div>

      <!-- 背景预览 -->
      <div
        v-if="config.background.imageUrl"
        class="relative w-full h-20 rounded-lg overflow-hidden border border-base-200/30"
      >
        <img
          :src="config.background.imageUrl"
          class="w-full h-full object-cover"
          alt="Background preview"
        />
      </div>

      <!-- 不透明度 -->
      <div class="flex items-center gap-3">
        <label class="text-xs text-base-content/50 w-24 shrink-0">
          {{ t("blackhole.background.opacity") }}
        </label>
        <input
          type="range"
          class="range range-sm range-primary flex-1"
          :min="0"
          :max="1"
          :step="0.01"
          :value="config.background.opacity"
          @input="updateBackground('opacity', $event)"
        />
        <span class="text-xs w-10 text-right">
          {{ config.background.opacity.toFixed(2) }}
        </span>
      </div>

      <!-- 适配方式 -->
      <div class="flex items-center gap-3">
        <label class="text-xs text-base-content/50 w-24 shrink-0">
          {{ t("blackhole.background.fitMode") }}
        </label>
        <select
          class="select select-sm select-bordered flex-1"
          :value="config.background.fitMode"
          @change="updateBackground('fitMode', $event)"
        >
          <option value="cover">
            {{ t("blackhole.background.fitModes.cover") }}
          </option>
          <option value="stretch">
            {{ t("blackhole.background.fitModes.stretch") }}
          </option>
          <option value="center">
            {{ t("blackhole.background.fitModes.center") }}
          </option>
          <option value="tile">
            {{ t("blackhole.background.fitModes.tile") }}
          </option>
        </select>
      </div>
    </div>

    <!-- 重置按钮 -->
    <button class="btn btn-sm btn-outline btn-error mt-2" @click="resetDefaults">
      {{ t("common.resetToDefaults") }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { BlackholeConfig } from "../types";
import { BLACKHOLE_PARAM_RANGES, DEFAULT_BLACKHOLE_CONFIG } from "../constants";

const { t } = useI18n();

const config = defineModel<BlackholeConfig>({ required: true });
const ranges = BLACKHOLE_PARAM_RANGES;

function update(key: string, event: Event) {
  const target = event.target as HTMLInputElement;
  const val = parseFloat(target.value);
  (config.value as any)[key] = val;
}

function updateBackground(key: string, event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (key === "opacity") {
    config.value.background.opacity = parseFloat(target.value);
  } else if (key === "fitMode") {
    config.value.background.fitMode = target.value as any;
  }
}

function onBackgroundUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result;
    if (typeof result === "string") {
      config.value.background.imageUrl = result;
    }
  };
  reader.readAsDataURL(file);
  target.value = "";
}

function removeBackground() {
  config.value.background.imageUrl = "";
}

function formatValue(key: string, val: number): string {
  if (key === "diskTemp") return Math.round(val).toString();
  if (key === "diskIncl" || key === "diskRoll") return val.toFixed(2);
  if (Number.isInteger(ranges[key]?.step)) return Math.round(val).toString();
  return val.toFixed(2);
}

function resetDefaults() {
  config.value = { ...DEFAULT_BLACKHOLE_CONFIG };
}
</script>
