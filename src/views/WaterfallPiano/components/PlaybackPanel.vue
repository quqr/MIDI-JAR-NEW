<template>
  <div class="flex flex-col gap-4">
    <!-- 录制控制 -->
    <div>
      <div class="text-xs opacity-50 mb-2">
        {{ t("waterfallPiano.record") }}
      </div>
      <div class="flex items-center gap-2">
        <button
          class="btn btn-circle btn-sm"
          :class="{ 'btn-error': isRecording }"
          :aria-label="t('waterfallPiano.record')"
          @click="$emit('toggleRecord')"
        >
          <span class="text-xs">●</span>
        </button>
        <button
          class="btn btn-circle btn-sm btn-ghost"
          :aria-label="t('waterfallPiano.stop')"
          @click="$emit('stopAll')"
        >
          <span class="text-xs">■</span>
        </button>
        <button
          class="btn btn-circle btn-sm"
          :class="{ 'btn-success': isPlaying }"
          :disabled="!hasContent"
          :aria-label="
            isPlaying ? t('waterfallPiano.pause') : t('waterfallPiano.play')
          "
          @click="$emit('togglePlayback')"
        >
          <span class="text-xs">{{ isPlaying ? "❚❚" : "▶" }}</span>
        </button>
        <div
          v-if="isRecording"
          class="badge badge-error badge-sm animate-pulse"
        >
          REC
        </div>
      </div>
    </div>

    <!-- 进度条 -->
    <div v-if="hasContent">
      <div class="text-xs opacity-50 mb-2">Progress</div>
      <div class="flex items-center gap-2">
        <span class="text-xs opacity-50 font-mono w-10 text-right">{{
          formatTime(currentTime)
        }}</span>
        <input
          type="range"
          class="range range-xs range-primary flex-1"
          min="0"
          :max="duration"
          step="0.1"
          :value="currentTime"
          :disabled="!seekable"
          @input="onSeek"
        />
        <span class="text-xs opacity-50 font-mono w-10">{{
          formatTime(duration)
        }}</span>
      </div>
    </div>

    <!-- MIDI 导入 -->
    <div>
      <div class="text-xs opacity-50 mb-2">MIDI</div>
      <button
        class="btn btn-ghost btn-sm gap-1 w-full justify-start"
        :aria-label="t('waterfallPiano.importMidi')"
        @click="fileInput?.click()"
      >
        <span class="text-xs">⬆</span>
        <span class="text-xs">{{ t("waterfallPiano.importMidi") }}</span>
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".mid,.midi"
        class="hidden"
        @change="onFileSelected"
      />
    </div>

    <!-- 状态信息 -->
    <div>
      <div class="text-xs opacity-50 mb-2">Status</div>
      <div class="flex flex-col gap-1">
        <div
          v-if="noteCount > 0 && !midiFileName"
          class="badge badge-success badge-sm w-fit"
        >
          {{ noteCount }} notes
        </div>
        <span v-if="midiFileName" class="text-xs opacity-50 truncate">
          {{ midiFileName }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRef } from "vue";
import { useI18n } from "vue-i18n";
import { useWaterfallPianoStore } from "../stores/waterfallPiano";

const { t } = useI18n();
const store = useWaterfallPianoStore();
const fileInput = ref<HTMLInputElement>();

const isRecording = toRef(store, "isRecording");
const isPlaying = toRef(store, "isPlaying");
const noteCount = computed(() => store.recordedNotes.length);
const midiFileName = computed(() => store.currentMidiFileName);

const duration = ref(0);
const currentTime = ref(0);
const seekable = ref(false);

const hasContent = computed(
  () => noteCount.value > 0 || midiFileName.value !== "",
);

const emit = defineEmits<{
  toggleRecord: [];
  stopAll: [];
  togglePlayback: [];
  importMidi: [file: File];
  seek: [seconds: number];
}>();

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    emit("importMidi", file);
  }
  input.value = "";
}

function onSeek(e: Event) {
  const input = e.target as HTMLInputElement;
  const seconds = parseFloat(input.value);
  emit("seek", seconds);
}

function setProgress(_progress: number, seconds: number) {
  currentTime.value = seconds;
}

function setMidiInfo(name: string, dur: number) {
  store.currentMidiFileName = name;
  duration.value = dur;
  seekable.value = true;
}

function setDuration(dur: number) {
  duration.value = dur;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

defineExpose({ setProgress, setMidiInfo, setDuration });
</script>
