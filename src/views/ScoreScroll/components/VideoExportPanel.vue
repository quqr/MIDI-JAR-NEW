<template>
  <div class="flex flex-col gap-2">
    <!-- 能力预检：无 WebCodecs 时禁用导出 -->
    <div
      v-if="!webCodecsSupported"
      class="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning"
    >
      {{ t("videoExport.unsupported") }}
    </div>
    <template v-else>
      <!-- 取景矩形（导出摄像机）：直接在谱面视口拖拽调整 -->
      <p class="text-xs leading-5 text-base-content/60">
        {{ t("videoExport.cameraHint") }}
      </p>
      <SettingsToggle
        :model-value="cameraPreview"
        :label="t('videoExport.cameraPreview')"
        :disabled="isExporting"
        @update:model-value="(v) => (cameraPreview = v)"
      />

      <!-- 编码格式（仅展示当前环境可用的编码） -->
      <SettingsSelect
        v-if="supportedCodecOptions.length > 0"
        :model-value="codec"
        :label="t('videoExport.codec')"
        :options="supportedCodecOptions"
        :disabled="isExporting"
        @update:model-value="(v) => (codec = v as VideoCodecValue)"
      />
      <p v-else-if="codecProbeDone" class="text-sm text-error">
        {{ t("videoExport.noCodec") }}
      </p>

      <SettingsSelect
        :model-value="shortSide"
        :label="t('videoExport.resolution')"
        :options="resolutionOptions"
        :disabled="isExporting"
        @update:model-value="(v) => (shortSide = Number(v))"
      />
      <SettingsSelect
        :model-value="fps"
        :label="t('videoExport.fps')"
        :options="fpsOptions"
        :disabled="isExporting"
        @update:model-value="(v) => (fps = Number(v))"
      />

      <!-- 编码执行模式（GPU 硬件 / CPU 软件）：导出探测后回填，验证硬件加速是否生效 -->
      <div
        v-if="encodingMode"
        class="flex items-center gap-2 text-sm text-base-content/70"
      >
        <span>{{ t("videoExport.encodingMode") }}</span>
        <span
          class="badge badge-sm"
          :class="encodingMode === 'gpu' ? 'badge-success' : 'badge-warning'"
        >
          {{
            encodingMode === "gpu" ? t("videoExport.gpu") : t("videoExport.cpu")
          }}
        </span>
      </div>

      <!-- 操作区 -->
      <button
        v-if="!isExporting"
        class="btn btn-primary btn-sm"
        :disabled="supportedCodecOptions.length === 0"
        @click="$emit('start')"
      >
        {{ t("videoExport.start") }}
      </button>
      <div v-else class="flex flex-col gap-2">
        <progress
          class="progress progress-primary w-full"
          :value="Math.round(progress * 100)"
          max="100"
        ></progress>
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="tabular-nums text-base-content/60">
            {{ t("videoExport.progress") }} {{ Math.round(progress * 100) }}%
            <template v-if="realtimeFactor !== null">
              · ×{{ realtimeFactor.toFixed(1) }}
              {{ t("videoExport.realtime") }}
            </template>
          </span>
          <button class="btn btn-warning btn-xs" @click="cancel">
            {{ t("videoExport.cancel") }}
          </button>
        </div>
      </div>

      <!-- 完成 -->
      <p
        v-if="done"
        class="rounded-lg bg-success/10 px-3 py-2 text-sm text-success"
      >
        {{ t("videoExport.done") }}
        <template v-if="realtimeFactor !== null">
          （×{{ realtimeFactor.toFixed(1) }} {{ t("videoExport.realtime") }}）
        </template>
      </p>

      <!-- 错误 -->
      <p
        v-if="error"
        class="rounded-lg bg-error/10 px-3 py-2 text-sm text-error"
      >
        {{ t("videoExport.error") }}: {{ error }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 视频导出设置面板（右侧设置栏内联，无弹窗）：
 * 取景矩形（宽度/高度/垂直位置滑条 + 预览灰显）、编码格式（仅可用项）、
 * 分辨率/帧率、GPU|CPU 编码模式标签、导出进度与取消。
 * 状态来自 useVideoExport 单例；谱面数据由父组件在 start 事件组装。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingsSelect from "@/components/Settings/SettingsSelect.vue";
import SettingsToggle from "@/components/Settings/SettingsToggle.vue";
import {
  VIDEO_CODECS,
  VIDEO_FPS,
  VIDEO_RESOLUTIONS,
  type VideoCodecValue,
} from "../utils/videoExport";
import { useVideoExport } from "../composables/useVideoExport";

defineEmits<{
  (e: "start"): void;
}>();

const { t } = useI18n();
const {
  isExporting,
  progress,
  error,
  done,
  codec,
  shortSide,
  fps,
  cameraPreview,
  codecSupport,
  codecProbeDone,
  encodingMode,
  realtimeFactor,
  webCodecsSupported,
  cancel,
} = useVideoExport();

/** 编码显示名（标准名称，不随语言变化） */
const CODEC_LABELS: Record<VideoCodecValue, string> = {
  avc: "H.264",
  hevc: "H.265",
  av1: "AV1",
};

const supportedCodecOptions = computed(() =>
  VIDEO_CODECS.filter((c) => codecSupport.value[c.value]).map((c) => ({
    value: c.value,
    label: CODEC_LABELS[c.value],
  })),
);

const resolutionOptions = VIDEO_RESOLUTIONS.map((r) => ({
  value: r,
  label: `${r}p`,
}));
const fpsOptions = VIDEO_FPS.map((f) => ({ value: f, label: `${f} fps` }));
</script>
