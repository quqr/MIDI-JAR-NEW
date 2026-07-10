<template>
  <div class="bg-base-200/80 backdrop-blur-md border-t border-base-300/50 px-3 py-2 sm:px-4 sm:py-3">
    <div class="flex flex-col gap-2 max-w-6xl mx-auto">
      <!-- 顶行：模式切换 + 文件/录制 -->
      <div class="flex items-center gap-2 flex-wrap">
        <div class="join">
          <button
            class="btn btn-xs sm:btn-sm join-item"
            :class="mode === 'realtime' ? 'btn-primary' : 'btn-ghost'"
            :aria-pressed="mode === 'realtime'"
            @click="$emit('update:mode', 'realtime')"
          >
            <Icon name="piano" :size="14" aria-hidden="true" />
            <span class="hidden sm:inline">{{ t('waterfallPiano.mode.realtime') }}</span>
          </button>
          <button
            class="btn btn-xs sm:btn-sm join-item"
            :class="mode === 'synthesia' ? 'btn-primary' : 'btn-ghost'"
            :aria-pressed="mode === 'synthesia'"
            @click="$emit('update:mode', 'synthesia')"
          >
            <Icon name="layers" :size="14" aria-hidden="true" />
            <span class="hidden sm:inline">{{ t('waterfallPiano.mode.synthesia') }}</span>
          </button>
        </div>

        <div class="flex-1"></div>

        <label class="btn btn-xs sm:btn-sm btn-ghost gap-1 cursor-pointer">
          <Icon name="music" :size="14" aria-hidden="true" />
          <span class="hidden sm:inline">{{ t('waterfallPiano.loadMidi') }}</span>
          <input
            type="file"
            accept=".mid,.midi,audio/midi"
            class="hidden"
            @change="onFileChange"
          />
        </label>

        <button
          class="btn btn-xs sm:btn-sm gap-1"
          :class="isRecording ? 'btn-error' : 'btn-ghost'"
          :aria-pressed="isRecording"
          @click="$emit('toggleRecord')"
        >
          <span
            class="inline-block w-2.5 h-2.5 rounded-full"
            :class="isRecording ? 'bg-white animate-pulse' : 'bg-error'"
            aria-hidden="true"
          ></span>
          <span class="hidden sm:inline">{{ isRecording ? t('waterfallPiano.recording') : t('waterfallPiano.record') }}</span>
        </button>
      </div>

      <!-- 中行：播放控制 + 进度 -->
      <div class="flex items-center gap-2 sm:gap-3">
        <button
          v-if="!isPlaying"
          class="btn btn-sm btn-circle btn-primary"
          :disabled="!canPlay"
          :aria-label="t('waterfallPiano.play')"
          @click="$emit('play')"
        >
          <Icon name="play" :size="16" aria-hidden="true" />
        </button>
        <button
          v-else
          class="btn btn-sm btn-circle btn-primary"
          :aria-label="t('waterfallPiano.pause')"
          @click="$emit('pause')"
        >
          <span class="block w-3 h-3 border-l-2 border-r-2 border-current" aria-hidden="true"></span>
        </button>
        <button
          class="btn btn-sm btn-circle btn-ghost"
          :disabled="!isPlaying && !isPaused"
          :aria-label="t('waterfallPiano.stop')"
          @click="$emit('stop')"
        >
          <span class="block w-3 h-3 bg-current rounded-sm" aria-hidden="true"></span>
        </button>

        <span class="text-xs font-mono text-base-content/70 tabular-nums w-10 text-right">{{ formatTime(currentTime) }}</span>
        <input
          type="range"
          class="range range-xs flex-1"
          :min="0"
          :max="Math.max(0.1, duration)"
          :step="0.01"
          :value="currentTime"
          :disabled="duration <= 0"
          :aria-label="t('waterfallPiano.play')"
          @input="$emit('seek', Number(($event.target as HTMLInputElement).value))"
        />
        <span class="text-xs font-mono text-base-content/70 tabular-nums w-10">{{ formatTime(duration) }}</span>
      </div>

      <!-- 底行：synthesia 选项 -->
      <div v-if="mode === 'synthesia'" class="flex items-center gap-2 flex-wrap">
        <div class="join">
          <button
            v-for="s in speedOptions"
            :key="s"
            class="btn btn-xs join-item"
            :class="playbackSpeed === s ? 'btn-active' : 'btn-ghost'"
            @click="$emit('setSpeed', s)"
          >{{ s }}x</button>
        </div>

        <button
          class="btn btn-xs btn-ghost gap-1"
          :class="{ 'btn-active': loop }"
          @click="$emit('toggleLoop')"
        >
          <Icon name="refresh" :size="12" aria-hidden="true" />
          <span class="hidden sm:inline">{{ t('waterfallPiano.loop') }}</span>
        </button>

        <div v-if="tracks.length > 0" class="dropdown dropdown-top">
          <label tabindex="0" class="btn btn-xs btn-ghost gap-1">
            <Icon name="layers" :size="12" aria-hidden="true" />
            <span class="hidden sm:inline">{{ t('waterfallPiano.tracks') }} ({{ selectedTracks.length }})</span>
          </label>
          <div tabindex="0" class="dropdown-content menu bg-base-100 rounded-box shadow-lg w-56 max-h-64 overflow-y-auto z-50">
            <ul>
              <li v-for="track in tracks" :key="track.index">
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-xs"
                    :value="track.index"
                    :checked="selectedTracks.includes(track.index)"
                    @change="onTrackToggle(track.index)"
                  />
                  <span class="text-xs truncate">{{ track.name }} ({{ track.noteCount }})</span>
                </label>
              </li>
            </ul>
          </div>
        </div>

        <div v-if="fileName" class="text-xs text-base-content/60 truncate ml-auto max-w-[40%]">{{ fileName }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import type { MidiTrackInfo } from "../types";
import type { NoteBlockMode } from "../engine/NoteBlockSystem";

const props = defineProps<{
  mode: NoteBlockMode;
  isRecording: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  fileName?: string;
  tracks: MidiTrackInfo[];
  selectedTracks: number[];
  playbackSpeed: number;
  loop: boolean;
  hasContent: boolean;
}>();

const emit = defineEmits<{
  (e: "update:mode", mode: NoteBlockMode): void;
  (e: "toggleRecord"): void;
  (e: "play"): void;
  (e: "pause"): void;
  (e: "stop"): void;
  (e: "seek", seconds: number): void;
  (e: "loadMidi", file: File): void;
  (e: "selectTracks", indices: number[]): void;
  (e: "setSpeed", speed: number): void;
  (e: "toggleLoop"): void;
}>();

const { t } = useI18n();

const speedOptions = [0.5, 0.75, 1, 1.5, 2];

const canPlay = computed(() => props.hasContent && props.duration > 0);

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("loadMidi", file);
  input.value = "";
}

function onTrackToggle(index: number): void {
  const set = new Set(props.selectedTracks);
  if (set.has(index)) set.delete(index);
  else set.add(index);
  emit("selectTracks", Array.from(set).sort((a, b) => a - b));
}
</script>
