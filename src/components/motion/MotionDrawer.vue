<template>
  <AnimatePresence>
    <template v-if="isOpen">
      <motion.div
        key="overlay"
        :initial="overlay.initial"
        :animate="overlay.animate"
        :exit="overlay.exit"
        :transition="overlay.transition"
        class="motion-drawer__overlay"
        @click="$emit('close')"
      />
      <motion.aside
        key="panel"
        :initial="panel.initial"
        :animate="panel.animate"
        :exit="panel.exit"
        :transition="panel.transition"
        class="motion-drawer__panel"
        :class="[`motion-drawer__panel--${side}`]"
        :style="{ width: `${width}px` }"
      >
        <slot />
      </motion.aside>
    </template>
  </AnimatePresence>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { motion, AnimatePresence } from "motion-v";
import {
  useMotionPresets,
  drawerRight,
  drawerLeft,
  overlayFade,
} from "@/utils/motion";
import type { MotionDrawerProps } from "./index";

const props = withDefaults(defineProps<MotionDrawerProps>(), {
  side: "right",
  width: 320,
});

defineEmits<{ close: [] }>();

const { resolve } = useMotionPresets();
const overlay = computed(() => resolve(overlayFade));
const panel = computed(() =>
  resolve(props.side === "right" ? drawerRight : drawerLeft),
);
</script>

<style scoped>
.motion-drawer__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background-color: rgb(0 0 0 / 0.4);
}

.motion-drawer__panel {
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: var(--z-drawer);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: color-mix(in oklch, var(--color-base-100) 80%, transparent);
  box-shadow: var(--shadow-hig-xl);
}

.motion-drawer__panel--right {
  right: 0;
  border-left: 1px solid
    color-mix(in oklch, var(--color-base-content) 8%, transparent);
}

.motion-drawer__panel--left {
  left: 0;
  border-right: 1px solid
    color-mix(in oklch, var(--color-base-content) 8%, transparent);
}
</style>
