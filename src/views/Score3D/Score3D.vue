<template>
  <div class="relative h-full w-full overflow-hidden">
    <Score3dCanvas @ready="onEngineReady" />

    <!-- 顶部提示 -->
    <div
      v-if="!loaded"
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <p class="text-base-content/60 text-sm">
        {{ $t("score3d.emptyHint") }}
      </p>
    </div>

    <!-- 加载中遮罩 -->
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-black/30"
    >
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <!-- 底部控制面板 -->
    <div
      class="absolute bottom-0 left-0 right-0 z-10 bg-base-200/80 backdrop-blur px-4 py-3 space-y-3"
    >
      <div class="flex items-center gap-3">
        <label class="btn btn-primary btn-sm">
          {{ $t("score3d.load") }}
          <input
            type="file"
            accept=".mid,.midi"
            class="hidden"
            @change="onFileChange"
          />
        </label>

        <button
          class="btn btn-square btn-sm"
          :disabled="!loaded"
          :aria-label="$t('score3d.play')"
          @click="play()"
        >
          <Icon name="play" :size="16" />
        </button>
        <button
          class="btn btn-square btn-sm"
          :disabled="!loaded"
          :aria-label="$t('score3d.pause')"
          @click="pause()"
        >
          <Icon name="pause" :size="16" />
        </button>
        <button
          class="btn btn-square btn-sm"
          :disabled="!loaded"
          :aria-label="$t('score3d.stop')"
          @click="stop()"
        >
          <Icon name="stop" :size="16" />
        </button>

        <input
          type="range"
          class="range range-primary range-xs flex-1"
          min="0"
          :max="Math.max(duration, 0.001)"
          step="0.01"
          :value="currentTime"
          :disabled="!loaded"
          :aria-label="$t('score3d.progress')"
          @input="onSeek"
        />
        <span class="font-mono text-xs text-base-content/70 tabular-nums">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </span>
      </div>

      <div v-if="trackInfos.length > 0" class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-base-content/60">
          {{ $t("score3d.tracks") }}
        </span>
        <button
          v-for="info in trackInfos"
          :key="info.trackIndex"
          class="btn btn-xs"
          :class="
            visibleTracks.has(info.trackIndex) ? 'btn-outline' : 'btn-ghost'
          "
          :style="trackButtonStyle(info.trackIndex)"
          @click="
            setTrackVisible(info.trackIndex, !visibleTracks.has(info.trackIndex))
          "
        >
          {{ $t("score3d.track") }} {{ info.trackIndex + 1 }} ({{ info.noteCount }})
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@/components/Icon";
import { TRACK_COLORS } from "../constants";
import { useScore3dEngine } from "./composables/useScore3dEngine";
import Score3dCanvas from "./components/Score3dCanvas.vue";

const {
  currentTime,
  duration,
  trackInfos,
  visibleTracks,
  loaded,
  loading,
  onEngineReady,
  load,
  play,
  pause,
  stop,
  seek,
  setTrackVisible,
} = useScore3dEngine();

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void load(file);
  input.value = "";
}

function onSeek(event: Event): void {
  seek(Number((event.target as HTMLInputElement).value));
}

function trackButtonStyle(trackIndex: number): Record<string, string> {
  return { "--btn-color": TRACK_COLORS[trackIndex % TRACK_COLORS.length] };
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${String(m).padStart(2, "0")}:${rest.toFixed(1).padStart(4, "0")}`;
}
</script>
