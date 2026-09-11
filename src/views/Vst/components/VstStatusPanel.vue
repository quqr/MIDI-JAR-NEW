<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import RangeSlider from "@/components/common/RangeSlider.vue";
import type { RangeSliderValue } from "@/components/common/rangeSlider";
import { optionIndexOf } from "@/components/common/rangeSlider";
import { Icon } from "@/components/Icon";
import StateDot from "@/components/common/StateDot.vue";
import type { ToneSource } from "@/types/vst";
import type { VstStatusPanelProps } from "./props";

// ─── 顶部状态面板（仪表盘一卡三区） ───
// 左：音源来源 3 档滑条 + 状态徽标；中：当前插件信息；右：插件操作。
// VST 错误时整卡切换为 alert-error 风格。

const props = defineProps<VstStatusPanelProps>();

const emit = defineEmits<{
  (e: "changeToneSource", value: ToneSource): void;
  (e: "reload"): void;
  (e: "toggleEditor"): void;
  (e: "unload"): void;
}>();

const { t } = useI18n();

const isVstActive = computed(() => props.toneSource === "vst");
const isRunning = computed(() => props.status.state === "running");
const isError = computed(() => props.status.state === "error");

const toneSourceIndex = computed(() =>
  Math.max(0, optionIndexOf(props.toneSourceOptions, props.toneSource)),
);

const toneSourceHint = computed(() => {
  const source = props.toneSource;
  return source === "vst"
    ? t("vst.toneSourceHintVst")
    : source === "sampler"
      ? t("vst.toneSourceHintSampler")
      : t("vst.toneSourceHintNone");
});

const stateDot = computed<"success" | "error" | "neutral">(() =>
  isRunning.value ? "success" : isError.value ? "error" : "neutral",
);

const stateText = computed(() =>
  isRunning.value
    ? t("vst.stateRunning")
    : isError.value
      ? t("vst.stateError")
      : t("vst.stateIdle"),
);

function onSlide(value: RangeSliderValue) {
  const option = props.toneSourceOptions[Number(value)];
  if (option && option.value !== props.toneSource) {
    emit("changeToneSource", option.value);
  }
}
</script>

<template>
  <section
    class="card bg-base-100 border duration-150"
    :class="isError ? 'border-error/50 bg-error/5' : 'border-base-300'"
  >
    <div class="card-body p-5 gap-4">
      <div
        class="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] lg:items-center"
      >
        <!-- ── 左：音源来源 3 档 ── -->
        <div class="flex flex-col gap-2 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold">{{ t("vst.toneSource") }}</h2>
            <div
              v-if="isVstActive"
              class="badge gap-1.5"
              :class="{
                'badge-success': isRunning,
                'badge-error': isError,
                'badge-ghost': !isRunning && !isError,
              }"
            >
              <StateDot :status="stateDot" size="xs" />
              <span>{{ stateText }}</span>
            </div>
          </div>
          <RangeSlider
            :model-value="toneSourceIndex"
            :min="0"
            :max="props.toneSourceOptions.length - 1"
            :step="1"
            no-fill
            :tick-labels="props.toneSourceOptions.map((o) => o.label)"
            color="primary"
            :aria-label="t('vst.toneSource')"
            @update:model-value="onSlide"
          />
          <p class="text-xs text-base-content/60">{{ toneSourceHint }}</p>
        </div>

        <!-- ── 中：当前插件信息（仅 VST 激活时有意义） ── -->
        <div v-if="isVstActive" class="min-w-0">
          <!-- 错误态 -->
          <div v-if="isError" class="flex items-start gap-2 min-w-0">
            <Icon
              name="alert-circle"
              :size="18"
              class="shrink-0 text-error mt-0.5"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1 flex flex-col gap-0.5">
              <span class="font-medium text-sm">{{ t("vst.crashed") }}</span>
              <span
                v-if="props.status.message"
                class="text-xs break-all opacity-80"
              >
                {{ props.status.message }}
              </span>
            </div>
          </div>

          <!-- 运行态 -->
          <div
            v-else-if="isRunning && props.pluginInfo"
            class="flex items-center gap-2 min-w-0"
          >
            <StateDot status="success" size="sm" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium truncate">{{
                  props.pluginInfo.name
                }}</span>
                <span
                  v-if="props.pluginInfo.audioRunning"
                  class="badge badge-success badge-outline badge-xs"
                >
                  {{ t("vst.audioRunning") }}
                </span>
              </div>
              <p
                class="text-xs text-base-content/60 truncate mt-0.5"
                :title="props.pluginInfo.path"
              >
                {{ props.pluginInfo.vendor }}
                <template v-if="props.pluginInfo.vendor">·</template>
                {{ props.pluginInfo.path }}
              </p>
            </div>
          </div>

          <!-- 加载中 -->
          <div
            v-else-if="props.isLoading"
            class="flex items-center gap-2 text-sm text-base-content/70"
          >
            <span class="loading loading-spinner loading-sm"></span>
            <span>{{ t("vst.loading") }}</span>
          </div>

          <!-- 空态 -->
          <p v-else class="text-sm text-base-content/60">
            {{ t("vst.noPluginSelected") }}
          </p>
        </div>

        <!-- ── 右：插件操作 ── -->
        <div v-if="isVstActive" class="flex flex-wrap gap-2 lg:justify-end">
          <button
            class="btn btn-outline btn-xs sm:btn-sm"
            :disabled="!isRunning || !props.pluginInfo"
            @click="emit('toggleEditor')"
          >
            <Icon name="window" :size="14" aria-hidden="true" />
            <span>{{
              props.pluginInfo?.editorOpen
                ? t("vst.closeEditor")
                : t("vst.openEditor")
            }}</span>
          </button>
          <button
            class="btn btn-outline btn-xs sm:btn-sm"
            :disabled="!props.hasSelection"
            @click="emit('reload')"
          >
            <Icon name="refresh" :size="14" aria-hidden="true" />
            <span>{{ t("vst.reload") }}</span>
          </button>
          <button
            class="btn btn-ghost btn-xs sm:btn-sm text-error"
            :disabled="!props.hasSelection"
            @click="emit('unload')"
          >
            <Icon name="power" :size="14" aria-hidden="true" />
            <span>{{ t("vst.unload") }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
