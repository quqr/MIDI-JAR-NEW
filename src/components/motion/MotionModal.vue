<template>
  <AnimatePresence>
    <motion.div
      v-if="isOpen"
      key="modal-root"
      :initial="root.initial"
      :animate="root.animate"
      :exit="root.exit"
      :transition="root.transition"
      class="motion-modal"
    >
      <div
        class="motion-modal__overlay"
        @click="closeOnOverlay ? $emit('close') : undefined"
      />
      <motion.div
        :initial="box.initial"
        :animate="box.animate"
        :exit="box.exit"
        :transition="box.transition"
        class="motion-modal__box"
      >
        <slot />
      </motion.div>
    </motion.div>
  </AnimatePresence>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { motion, AnimatePresence } from "motion-v";
import { useMotionPresets, overlayFade, modal } from "@/utils/motion";
import type { MotionModalProps } from "./index";

const props = withDefaults(defineProps<MotionModalProps>(), {
  closeOnOverlay: true,
});

defineEmits<{ close: [] }>();

const { resolve } = useMotionPresets();
const root = computed(() => resolve(overlayFade));
const box = computed(() => resolve(modal));
</script>

<style scoped>
.motion-modal {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.motion-modal__overlay {
  position: absolute;
  inset: 0;
  background-color: rgb(0 0 0 / 0.4);
  backdrop-filter: blur(2px) saturate(180%);
  -webkit-backdrop-filter: blur(2px) saturate(180%);
}

.motion-modal__box {
  position: relative;
  z-index: var(--z-sticky);
  width: 100%;
  max-width: 32rem;
  max-height: calc(100vh - 2rem);
  overflow: auto;
  background-color: var(--color-base-100);
  color: var(--color-base-content);
  border: 1px solid var(--color-base-300);
  border-radius: var(--radius-box);
  box-shadow: var(--shadow-hig-2xl);
}
</style>
