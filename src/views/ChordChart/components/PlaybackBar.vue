<script setup lang="ts">
/**
 * 内嵌播放控制条（计划 Phase 4）。
 *
 * 播放/暂停/停止、chorus 计数、速度（0.5×–1.5×）、变调（±12 半音，
 * 作用于输出 MIDI 不改谱）、三声部静音、风格选择（默认跟随 meta.style）。
 * 乐器加载中显示 spinner；编译错误显示错误徽章。
 */
import { computed } from "vue";

import { Icon } from "@/components/Icon";

import { usePlaybackStore } from "../stores/Playback";
import { GROOVES } from "../playback/grooves";

import type { AccompanimentTrack } from "../playback/compGenerator";

const playback = usePlaybackStore();

const isPlaying = computed(() => playback.status === "playing");

/** chorus 显示：2/3（暂停/播放时） */
const chorusLabel = computed(() =>
  `${playback.chorusIndex + 1}/${playback.chorusCount}`,
);

/** 速度滑杆显示值（百分比） */
const tempoPercent = computed(() => Math.round(playback.tempoScale * 100));

const TRACKS: Array<{ key: AccompanimentTrack; icon: "music" | "speaker"; labelKey: string }> = [
  { key: "piano", icon: "music", labelKey: "chordChart.playback.trackPiano" },
  { key: "bass", icon: "music", labelKey: "chordChart.playback.trackBass" },
  { key: "drums", icon: "speaker", labelKey: "chordChart.playback.trackDrums" },
];

const transposeLabel = computed(() => {
  const v = playback.transposition;
  return v > 0 ? `+${v}` : `${v}`;
});

function onPlayPause(): void {
  if (isPlaying.value) {
    playback.pause();
  } else {
    void playback.play();
  }
}
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 rounded-xl bg-base-200/60 border border-base-content/10"
  >
    <!-- 走带控制 -->
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="btn btn-primary btn-sm btn-square"
        :title="isPlaying ? $t('chordChart.playback.pause') : $t('chordChart.playback.play')"
        :aria-label="isPlaying ? $t('chordChart.playback.pause') : $t('chordChart.playback.play')"
        :disabled="playback.compileError !== null"
        @click="onPlayPause"
      >
        <span v-if="playback.isLoadingInstruments" class="loading loading-spinner loading-xs" />
        <Icon v-else-if="isPlaying" name="pause" :size="14" />
        <Icon v-else name="play" :size="14" />
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square"
        :title="$t('chordChart.playback.stop')"
        :aria-label="$t('chordChart.playback.stop')"
        :disabled="playback.status === 'idle'"
        @click="playback.stop()"
      >
        <Icon name="stop" :size="14" />
      </button>
    </div>

    <!-- chorus 计数 -->
    <span
      v-if="playback.status !== 'idle'"
      class="badge badge-primary badge-sm badge-outline tabular-nums"
      :title="$t('chordChart.playback.chorus')"
    >
      {{ chorusLabel }}
    </span>

    <!-- 编译错误 -->
    <span
      v-if="playback.compileError"
      class="badge badge-error badge-sm gap-1"
    >
      <Icon name="error" :size="11" />
      {{ $t(playback.compileError) }}
    </span>
    <span
      v-else-if="playback.instrumentLoadError"
      class="badge badge-warning badge-sm gap-1"
      :title="playback.instrumentLoadError"
    >
      <Icon name="warning" :size="11" />
      {{ $t("chordChart.playback.instrumentError") }}
    </span>

    <!-- 速度 -->
    <label class="flex items-center gap-2 text-xs text-base-content/60">
      <span>{{ $t("chordChart.playback.tempo") }}</span>
      <input
        type="range"
        min="0.5"
        max="1.5"
        step="0.05"
        :value="playback.tempoScale"
        class="range range-primary range-xs w-28"
        :aria-label="$t('chordChart.playback.tempo')"
        @input="playback.setTempoScale(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="tabular-nums w-10 text-right">{{ tempoPercent }}%</span>
    </label>

    <!-- 变调 -->
    <div class="flex items-center gap-1 text-xs text-base-content/60">
      <span>{{ $t("chordChart.playback.transpose") }}</span>
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :aria-label="$t('chordChart.playback.transposeDown')"
        @click="playback.setTranspose(playback.transposition - 1)"
      >
        −
      </button>
      <span class="tabular-nums w-6 text-center font-medium">{{ transposeLabel }}</span>
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :aria-label="$t('chordChart.playback.transposeUp')"
        @click="playback.setTranspose(playback.transposition + 1)"
      >
        +
      </button>
    </div>

    <!-- 三声部静音 -->
    <div class="flex items-center gap-1">
      <button
        v-for="track in TRACKS"
        :key="track.key"
        type="button"
        class="btn btn-xs"
        :class="playback.mutedTracks[track.key] ? 'btn-ghost opacity-40 line-through' : 'btn-outline'"
        :title="$t(track.labelKey)"
        @click="playback.toggleMute(track.key)"
      >
        <Icon :name="track.icon" :size="11" />
        {{ $t(track.labelKey) }}
      </button>
    </div>

    <!-- 风格选择 -->
    <label class="ml-auto flex items-center gap-2 text-xs text-base-content/60">
      <span>{{ $t("chordChart.playback.groove") }}</span>
      <select
        :value="playback.grooveId ?? ''"
        class="select select-xs select-bordered"
        :aria-label="$t('chordChart.playback.groove')"
        @change="playback.setGroove(($event.target as HTMLSelectElement).value || null)"
      >
        <option value="">
          {{ $t("chordChart.playback.grooveFollowStyle", { style: playback.activeGroove.id }) }}
        </option>
        <option v-for="g in GROOVES" :key="g.id" :value="g.id">
          {{ $t(g.labelKey) }}
        </option>
      </select>
    </label>

    <!-- 编辑锁定提示 -->
    <span
      v-if="playback.editLocked"
      class="badge badge-neutral badge-sm"
      :title="$t('chordChart.playback.editLocked')"
    >
      {{ $t("chordChart.playback.editLocked") }}
    </span>
  </div>
</template>
