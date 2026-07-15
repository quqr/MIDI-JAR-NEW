<template>
  <div
    class="playback-panel group absolute bottom-0 left-0 right-0 z-40 transition-all duration-300"
    @mouseenter="expanded = true"
    @mouseleave="expanded = false"
  >
    <!-- 迷你进度条（始终可见） -->
    <div class="h-1 bg-white/10 cursor-pointer relative" @click="onProgressClick">
      <div
        class="h-full bg-primary/80 transition-[width] duration-100"
        :style="{ width: progressPercent + '%' }"
      />
      <div
        class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        :style="{ left: progressPercent + '%' }"
      />
    </div>

    <!-- 迷你控制行（始终可见） -->
    <div class="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md">
      <button
        v-if="!isPlaying"
        class="btn btn-xs btn-circle btn-ghost text-white hover:bg-white/20"
        :disabled="!canPlay"
        :aria-label="t('waterfallPiano.play')"
        @click="$emit('play')"
      >
        <Icon name="play" :size="14" aria-hidden="true" />
      </button>
      <button
        v-else
        class="btn btn-xs btn-circle btn-ghost text-white hover:bg-white/20"
        :aria-label="t('waterfallPiano.pause')"
        @click="$emit('pause')"
      >
        <span class="block w-2.5 h-2.5 border-l-2 border-r-2 border-current" aria-hidden="true" />
      </button>
      <button
        class="btn btn-xs btn-circle btn-ghost text-white/70 hover:bg-white/20 hover:text-white"
        :disabled="!isPlaying && !isPaused"
        :aria-label="t('waterfallPiano.stop')"
        @click="$emit('stop')"
      >
        <span class="block w-2.5 h-2.5 bg-current rounded-sm" aria-hidden="true" />
      </button>

      <span class="text-[10px] font-mono text-white/60 tabular-nums">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>

      <div class="flex-1"></div>

      <!-- 模式切换 -->
      <div class="join join-horizontal">
        <button
          class="btn btn-xs join-item text-white"
          :class="mode === 'realtime' ? 'bg-white/20' : 'btn-ghost hover:bg-white/10'"
          :aria-pressed="mode === 'realtime'"
          @click="$emit('update:mode', 'realtime')"
        >
          <Icon name="piano" :size="12" aria-hidden="true" />
        </button>
        <button
          class="btn btn-xs join-item text-white"
          :class="mode === 'synthesia' ? 'bg-white/20' : 'btn-ghost hover:bg-white/10'"
          :aria-pressed="mode === 'synthesia'"
          @click="$emit('update:mode', 'synthesia')"
        >
          <Icon name="layers" :size="12" aria-hidden="true" />
        </button>
      </div>

      <!-- 文件/录制 -->
      <label class="btn btn-xs btn-ghost text-white/70 hover:bg-white/10 hover:text-white cursor-pointer">
        <Icon name="music" :size="12" aria-hidden="true" />
        <input
          type="file"
          accept=".mid,.midi,audio/midi"
          class="hidden"
          @change="onFileChange"
        />
      </label>

      <button
        class="btn btn-xs btn-ghost gap-1"
        :class="isRecording ? 'text-error bg-error/20' : 'text-white/70 hover:bg-white/10 hover:text-white'"
        :aria-pressed="isRecording"
        @click="$emit('toggleRecord')"
      >
        <span
          class="inline-block w-2 h-2 rounded-full"
          :class="isRecording ? 'bg-error animate-pulse' : 'bg-error/60'"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- 展开区域（悬停时显示） -->
    <Transition name="expand">
      <div
        v-if="expanded"
        class="px-3 pb-2 pt-1 bg-black/60 backdrop-blur-md border-t border-white/5"
      >
        <!-- 进度条（展开版） -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] font-mono text-white/50 tabular-nums w-8 text-right">{{ formatTime(currentTime) }}</span>
          <input
            type="range"
            class="range range-xs flex-1 range-primary"
            :min="0"
            :max="Math.max(0.1, duration)"
            :step="0.01"
            :value="currentTime"
            :disabled="duration <= 0"
            :aria-label="t('waterfallPiano.play')"
            @input="$emit('seek', Number(($event.target as HTMLInputElement).value))"
          />
          <span class="text-[10px] font-mono text-white/50 tabular-nums w-8">{{ formatTime(duration) }}</span>
        </div>

        <!-- Synthesia 选项 -->
        <div v-if="mode === 'synthesia'" class="flex items-center gap-2 flex-wrap">
          <div class="join join-horizontal">
            <button
              v-for="s in speedOptions"
              :key="s"
              class="btn btn-xs join-item text-white"
              :class="playbackSpeed === s ? 'bg-white/20' : 'btn-ghost hover:bg-white/10'"
              @click="$emit('setSpeed', s)"
            >{{ s }}x</button>
          </div>

          <button
            class="btn btn-xs btn-ghost text-white gap-1"
            :class="{ 'bg-white/20': loop }"
            @click="$emit('toggleLoop')"
          >
            <Icon name="refresh" :size="11" aria-hidden="true" />
            <span class="text-[10px]">{{ t('waterfallPiano.loop') }}</span>
          </button>

          <div v-if="tracks.length > 0" class="dropdown dropdown-top">
            <label tabindex="0" class="btn btn-xs btn-ghost text-white gap-1 hover:bg-white/10">
              <Icon name="layers" :size="11" aria-hidden="true" />
              <span class="text-[10px]">{{ selectedTracks.length }} {{ t('waterfallPiano.tracks') }}</span>
            </label>
            <div tabindex="0" class="dropdown-content menu bg-base-100 rounded-box shadow-lg w-56 max-h-48 overflow-y-auto z-50">
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

          <div v-if="fileName" class="text-[10px] text-white/40 truncate ml-auto max-w-[40%]">{{ fileName }}</div>
        </div>

        <!-- Realtime 选项 -->
        <div v-else class="text-[10px] text-white/40">
          {{ t('waterfallPiano.mode.realtime') }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
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
const expanded = ref(false);

const speedOptions = [0.5, 0.75, 1, 1.5, 2];

const canPlay = computed(() => props.hasContent && props.duration > 0);

const progressPercent = computed(() => {
  if (!props.duration || props.duration <= 0) return 0;
  return Math.min(100, (props.currentTime / props.duration) * 100);
});

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

function onProgressClick(e: MouseEvent): void {
  if (props.duration <= 0) return;
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  emit("seek", ratio * props.duration);
}
</script>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>
