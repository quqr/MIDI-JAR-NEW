<template>
  <div
    class="absolute bottom-0 left-0 right-0 z-40 px-3 pb-3 pointer-events-none"
  >
    <div class="mx-auto max-w-[var(--hig-container-max)] pointer-events-auto">
      <div
        class="bg-black/30 backdrop-blur-md rounded-hig-lg border border-white/10 px-4 py-2 flex items-center gap-3"
        style="box-shadow: var(--shadow-hig-lg)"
      >
        <!-- 当前时间 -->
        <span
          class="text-hig-sm text-white/80 tabular w-12 text-right select-none"
        >
          {{ formatTime(currentTime) }}
        </span>

        <!-- 可拖拽进度条 -->
        <div class="flex-1 py-1.5 cursor-pointer" @click="onProgressClick">
          <div class="h-1.5 bg-white/15 rounded-full overflow-hidden">
            <div
              class="h-full bg-white/70 rounded-full transition-[width] duration-hig-fast"
              :style="{ width: progressPercent + '%' }"
            />
          </div>
        </div>

        <!-- 总时长 -->
        <span class="text-hig-sm text-white/60 tabular w-12 select-none">
          {{ formatTime(duration) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  currentTime: number;
  duration: number;
}>();

const emit = defineEmits<{
  (e: "seek", seconds: number): void;
}>();

const progressPercent = computed(() => {
  if (!props.duration || props.duration <= 0) return 0;
  return Math.min(100, (props.currentTime / props.duration) * 100);
});

function onProgressClick(e: MouseEvent): void {
  if (props.duration <= 0) return;
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  emit("seek", ratio * props.duration);
}

/** 将秒数格式化为 m:ss（等宽显示） */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
</script>
