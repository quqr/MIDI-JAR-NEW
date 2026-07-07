<template>
  <li
    role="treeitem"
    tabindex="0"
    class="px-3 py-1.5 rounded-lg cursor-pointer text-sm transition-colors hover:bg-base-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :class="{
      'bg-primary/10 text-primary font-semibold':
        selected === item.chordType.aliases[0],
      'opacity-50': item.isDisabled,
    }"
    @click="$emit('select', item.chordType.aliases[0])"
  >
    {{ item.chordType.aliases[0] }}
  </li>
</template>

<script setup lang="ts">
import type { ChordItem } from "./utils";

defineProps<{
  item: ChordItem;
  selected: string | null;
}>();

defineEmits<{
  (e: "select", value: string): void;
}>();
</script>
