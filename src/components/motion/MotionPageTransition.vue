<template>
  <AnimatePresence mode="wait">
    <motion.div
      :key="transitionKey"
      :initial="preset.initial"
      :animate="preset.animate"
      :exit="preset.exit"
      :transition="preset.transition"
      class="motion-page-transition"
    >
      <slot />
    </motion.div>
  </AnimatePresence>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { motion, AnimatePresence } from "motion-v";
import { useMotionPresets, pageFade } from "@/utils/motion";
import type { MotionPageTransitionProps } from "./index";

const props = withDefaults(defineProps<MotionPageTransitionProps>(), {
  variant: () => pageFade,
});

const route = useRoute();
const { resolve } = useMotionPresets();

const transitionKey = computed(() => props.routeKey ?? route.path);
const preset = computed(() => resolve(props.variant));
</script>

<style scoped>
.motion-page-transition {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}
</style>
