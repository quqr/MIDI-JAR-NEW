<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSamplerStore } from "@/stores/sampler";
import { useVstStore } from "@/stores/vst";

// ─── 导航栏常驻音源状态标签 ───
// 内容 = 音源图标 + 短标签（采样音源 / VST:插件名 / 无音源）。
// 状态着色：VST running → 常色描边；VST error → 红；none → 弱化灰。
// 数据源：sampler store 的 toneSource（单一决策源）+ vst store 的状态机。
// 渲染时机由父级控制（仅 isTauri()，浏览器无 VST 子系统）。

const { t } = useI18n();
const samplerStore = useSamplerStore();
const vstStore = useVstStore();

const label = computed(() => {
  switch (samplerStore.toneSource) {
    case "vst":
      return vstStore.pluginInfo?.name ?? t("vst.sourceVst");
    case "sampler":
      return t("vst.indicatorSampler");
    default:
      return t("vst.indicatorNone");
  }
});

const badgeClass = computed(() => {
  if (samplerStore.toneSource === "vst") {
    if (vstStore.hasError) return "badge-error";
    // 运行中用常色描边；已选中但未加载（empty）用幽灵徽标
    return vstStore.isRunning ? "badge-primary" : "badge-ghost";
  }
  // 无音源：弱化灰；采样器：正常幽灵徽标
  return samplerStore.toneSource === "none"
    ? "badge-ghost opacity-60"
    : "badge-ghost";
});

const tooltip = computed(() => {
  if (samplerStore.toneSource === "vst" && vstStore.errorMessage) {
    return t("vst.globalErrorTooltip", { message: vstStore.errorMessage });
  }
  return label.value;
});
</script>

<template>
  <RouterLink
    to="/vst"
    class="badge badge-soft h-6 min-h-6 max-w-44 gap-1.5 px-2 font-normal"
    :class="badgeClass"
    :title="tooltip"
    :aria-label="tooltip"
  >
    <span class="truncate">{{ label }}</span>
  </RouterLink>
</template>
