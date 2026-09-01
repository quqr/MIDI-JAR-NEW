<script setup lang="ts">
/**
 * 音频输入状态指示 — daisyUI status 圆点 + 文案，错误态提供重试。
 * 状态切换时圆点以 animejs 淡入（遵守 prefers-reduced-motion）。
 */
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { animate } from "animejs";
import type { TunerStatus } from "../types";

const props = defineProps<{
  status: TunerStatus;
  /** 发生错误时的 i18n key（tuner.errors.*） */
  errorKey: string;
}>();

const emit = defineEmits<{
  (e: "retry"): void;
}>();

const { t } = useI18n();

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const statusDot = ref<HTMLElement>();
let fadeAnim: ReturnType<typeof animate> | null = null;

const statusClass = computed(
  (): string =>
    ({
      idle: "status-neutral",
      starting: "status-warning",
      listening: "status-success",
      error: "status-error",
    })[props.status],
);

const statusText = computed(() => t(`tuner.status.${props.status}`));

const errorText = computed(() => (props.errorKey ? t(props.errorKey) : ""));

// 状态切换：圆点淡入一次（200ms），防重入
watch(
  () => props.status,
  () => {
    if (!statusDot.value) return;
    fadeAnim?.cancel();
    fadeAnim = animate(statusDot.value, {
      opacity: [0, 1],
      duration: prefersReducedMotion ? 0 : 200,
      ease: "outQuad",
    });
  },
);

onMounted(() => {
  if (!statusDot.value) return;
  fadeAnim = animate(statusDot.value, {
    opacity: [0, 1],
    duration: prefersReducedMotion ? 0 : 200,
    ease: "outQuad",
  });
});

onUnmounted(() => {
  fadeAnim?.revert();
  fadeAnim = null;
});
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <span ref="statusDot" class="status" :class="statusClass" />
    <span class="text-xs text-base-content/60">{{ statusText }}</span>

    <template v-if="status === 'error'">
      <span v-if="errorText" class="text-xs text-error">{{ errorText }}</span>
      <button type="button" class="btn btn-ghost btn-xs" @click="emit('retry')">
        {{ t("tuner.status.retry") }}
      </button>
    </template>
  </div>
</template>
