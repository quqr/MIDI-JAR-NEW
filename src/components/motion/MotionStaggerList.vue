<template>
  <motion.div
    :variants="staggerContainer"
    :initial="shouldAnimate ? 'hidden' : 'visible'"
    animate="visible"
    class="motion-stagger-list"
  >
    <slot />
  </motion.div>
</template>

<script setup lang="ts">
import { motion } from "motion-v";
import { staggerContainer } from "@/utils/motion";
import { useStaggerOnce } from "./useStaggerOnce";
import type { MotionStaggerListProps } from "./index";

const props = withDefaults(defineProps<MotionStaggerListProps>(), {
  once: false,
  onceKey: "default",
});

const { shouldAnimate } = useStaggerOnce(props.once, props.onceKey);
</script>

<style scoped>
/* 不强制 display，允许通过传入的工具类（如 grid）控制布局 */
.motion-stagger-list {
  min-width: 0;
}
</style>
