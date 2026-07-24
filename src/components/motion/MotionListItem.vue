<template>
  <motion.div :variants="staggerItem" class="motion-stagger-item">
    <slot />
  </motion.div>
</template>

<script setup lang="ts">
import { motion } from "motion-v";
import { staggerItem } from "@/utils/motion";
</script>
