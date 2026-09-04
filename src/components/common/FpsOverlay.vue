<template>
  <div
    v-if="enabled"
    class="pointer-events-none fixed left-2 top-12 z-[999] rounded-md border border-base-content/10 bg-base-200/80 px-2 py-0.5 font-mono text-xs tabular-nums text-base-content/80 backdrop-blur"
    role="status"
    aria-label="FPS"
  >
    {{ fps }} FPS
  </div>
</template>

<script setup lang="ts">
/**
 * 全局帧率悬浮显示（界面左上角、导航栏正下方，所有页面生效）。
 * 开关在「设置 → 通用」中（general.showFps）。
 *
 * 性能：仅开启时运行 rAF 计数循环，每 500ms 汇总一次帧数并更新一次文本，
 * 计数过程零 DOM 操作；关闭时循环完全停止。
 */
import { computed, onUnmounted, ref, watch } from "vue";
import { useSettingsStore } from "@/stores/settings";

const settingsStore = useSettingsStore();
const enabled = computed(() => settingsStore.settings.general.showFps === true);

const fps = ref(0);
let rafId = 0;
let frames = 0;
let windowStart = 0;

function tick(now: number): void {
  frames++;
  if (windowStart === 0) {
    windowStart = now;
  } else if (now - windowStart >= 500) {
    fps.value = Math.round((frames * 1000) / (now - windowStart));
    frames = 0;
    windowStart = now;
  }
  rafId = requestAnimationFrame(tick);
}

function start(): void {
  stop();
  frames = 0;
  windowStart = 0;
  rafId = requestAnimationFrame(tick);
}

function stop(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

watch(
  enabled,
  (on) => {
    if (on) start();
    else stop();
  },
  { immediate: true },
);

onUnmounted(stop);
</script>
