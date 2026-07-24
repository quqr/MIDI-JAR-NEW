<template>
  <motion.li
    role="treeitem"
    tabindex="0"
    class="px-3 py-1.5 rounded-hig-md cursor-pointer text-hig-sm transition-colors duration-hig-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-full cursor-interactive"
    :class="{
      'bg-primary/10 text-primary font-semibold':
        selected === item.chordType.aliases[0],
      'hover:bg-base-200/70':
        selected !== item.chordType.aliases[0] && !item.isDisabled,
      'opacity-50': item.isDisabled,
    }"
    :whileHover="selected === item.chordType.aliases[0] ? {} : { x: 2 }"
    :whilePress="{ scale: 0.97 }"
    :transition="spring.soft"
    @click="$emit('select', item.chordType.aliases[0])"
  >
    {{ item.chordType.aliases[0] }}
  </motion.li>
</template>

<script setup lang="ts">
import { motion } from "motion-v";
import { spring } from "@/utils/motion";
import type { ChordItem } from "./utils";

defineProps<{
  item: ChordItem;
  selected: string | null;
}>();

defineEmits<{
  (e: "select", value: string): void;
}>();
</script>
