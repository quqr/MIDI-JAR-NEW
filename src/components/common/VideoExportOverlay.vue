<template>
  <!-- 全屏阻断遮罩：导出期间禁止一切页面操作 -->
  <dialog v-if="open" class="modal modal-open" aria-modal="true">
    <div class="modal-box max-w-sm text-center">
      <span
        class="loading loading-spinner loading-lg text-primary mb-3"
        aria-hidden="true"
      ></span>
      <h3 class="text-lg font-bold text-base-content">
        {{ t("videoExport.exportingTitle") }}
      </h3>
      <p class="mt-1 text-sm text-base-content/60">
        {{ t("videoExport.exportingBlocked") }}
      </p>

      <progress
        class="progress progress-primary w-full mt-4"
        :value="Math.round(progress * 100)"
        max="100"
      ></progress>
      <p class="mt-2 text-sm tabular-nums text-base-content/70">
        {{ t("videoExport.progress") }} {{ Math.round(progress * 100) }}%
        <template v-if="realtimeFactor !== null && realtimeFactor !== undefined">
          · ×{{ realtimeFactor.toFixed(1) }} {{ t("videoExport.realtime") }}
        </template>
      </p>

      <div class="modal-action justify-center">
        <button class="btn btn-warning btn-sm" @click="$emit('cancel')">
          {{ t("videoExport.cancel") }}
        </button>
      </div>
    </div>
    <!-- 阻断 backdrop：不响应点击关闭，仅挡住底层交互 -->
    <div class="modal-backdrop bg-black/60"></div>
  </dialog>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * 视频导出进度阻断弹窗（瀑布流 / 乐谱滚动共用）。
 * open 时全屏遮罩禁止其他操作，仅提供进度展示与取消；
 * open=false 时整体卸载（导出结束/取消/出错后由面板展示结果）。
 */
const { t } = useI18n();
defineProps<{
  open: boolean;
  progress: number;
  realtimeFactor?: number | null;
}>();

defineEmits<{ cancel: [] }>();
</script>
