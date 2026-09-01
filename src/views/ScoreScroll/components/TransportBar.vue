<template>
  <div
    class="h-14 min-h-14 flex items-center gap-3 px-4 bg-base-100 border-t border-base-content/10"
  >
    <!-- 播放控制 -->
    <div class="flex items-center gap-1">
      <button
        class="btn btn-sm btn-circle"
        :class="isPlaying ? 'btn-warning' : 'btn-primary'"
        :disabled="disabled"
        :title="
          isPlaying
            ? t('scoreScroll.transport.pause')
            : t('scoreScroll.transport.play')
        "
        :aria-label="
          isPlaying
            ? t('scoreScroll.transport.pause')
            : t('scoreScroll.transport.play')
        "
        @click="onToggle"
      >
        <Icon
          :name="isPlaying ? 'pause' : 'play'"
          :size="16"
          aria-hidden="true"
        />
      </button>
      <button
        class="btn btn-sm btn-circle btn-ghost"
        :disabled="disabled"
        :title="t('scoreScroll.transport.stop')"
        :aria-label="t('scoreScroll.transport.stop')"
        @click="$emit('stop')"
      >
        <Icon name="stop" :size="16" aria-hidden="true" />
      </button>
    </div>

    <!-- 进度 -->
    <div class="flex-1 flex items-center gap-2 min-w-0">
      <span class="text-xs tabular-nums text-base-content/70 w-12 text-right">
        {{ formatTime(currentTime) }}
      </span>
      <input
        type="range"
        class="range range-primary range-xs flex-1"
        min="0"
        :max="duration"
        step="0.01"
        :value="currentTime"
        :disabled="disabled || duration <= 0"
        :aria-label="t('scoreScroll.title')"
        @input="onSeekInput"
      />
      <span class="text-xs tabular-nums text-base-content/50 w-12">
        {{ formatTime(duration) }}
      </span>
    </div>

    <!-- 小节与谱面信息（对齐原站 BARLINES/MEASURES/TIME SIG/BAR） -->
    <div
      v-if="meta"
      class="hidden lg:flex items-center gap-3 text-xs text-base-content/60 tabular-nums shrink-0"
    >
      <span>
        {{ t("scoreScroll.transport.barlines") }}:
        <b class="text-base-content/85">{{ meta.barlines }}</b>
      </span>
      <span>
        {{ t("scoreScroll.transport.measures") }}:
        <b class="text-base-content/85">{{ meta.measures }}</b>
      </span>
      <span>
        {{ t("scoreScroll.transport.timeSig") }}:
        <b class="text-base-content/85">{{ meta.timeSignature }}</b>
      </span>
      <span>
        {{ t("scoreScroll.transport.keySig") }}:
        <b class="text-base-content/85">{{ meta.keySignature }}</b>
      </span>
      <span class="badge badge-sm badge-ghost">
        {{ t("scoreScroll.transport.bar") }}
        {{ currentMeasureIndex >= 0 ? currentMeasureIndex + 1 : "-" }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 播放控制条：播放/暂停/停止、进度、小节与谱面元信息 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import type { ScoreMetaInfo, ScorePlaybackState } from "../types";

const props = defineProps<{
  playbackState: ScorePlaybackState;
  currentTime: number;
  duration: number;
  currentMeasureIndex: number;
  meta: ScoreMetaInfo | null;
}>();

const emit = defineEmits<{
  (e: "play"): void;
  (e: "pause"): void;
  (e: "stop"): void;
  (e: "seek", seconds: number): void;
}>();

const { t } = useI18n();

const isPlaying = computed(() => props.playbackState === "playing");
const disabled = computed(() => props.duration <= 0);

function onToggle(): void {
  if (isPlaying.value) {
    emit("pause");
  } else {
    emit("play");
  }
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(2).padStart(5, "0")}`;
}

function onSeekInput(e: Event): void {
  const value = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(value)) emit("seek", value);
}
</script>
