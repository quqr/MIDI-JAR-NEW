<template>
  <span
    class="status"
    :class="[statusClass, sizeClass]"
    :role="ariaLabel ? 'img' : undefined"
    :aria-label="ariaLabel || undefined"
  ></span>
</template>

<script setup lang="ts">
import { computed } from "vue";

type StatusType = "success" | "warning" | "error" | "info" | "neutral";
type DotSize = "xs" | "sm" | "md" | "lg";

const props = withDefaults(
  defineProps<{
    /** 语义状态色，对应 daisyUI 的 status-* 调色板 */
    status: StatusType;
    /** 圆点尺寸 */
    size?: DotSize;
    /** 无障碍标签，留空则不暴露 */
    ariaLabel?: string;
  }>(),
  { size: "md", ariaLabel: "" },
);

// neutral 不需要附加颜色类，仅保留基础 status 样式
const statusClass = computed(() =>
  props.status === "neutral" ? "" : `status-${props.status}`,
);
const sizeClass = computed(() => `status-${props.size}`);
</script>
