<template>
  <div class="absolute bottom-0 left-0 right-0 z-40">
    <!-- 迷你进度条（始终可见） -->
    <div
      class="h-1 bg-white/10 cursor-pointer relative"
      @click="onProgressClick"
    >
      <div
        class="h-full bg-primary/80 transition-[width] duration-100"
        :style="{ width: progressPercent + '%' }"
      />
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
</script>
