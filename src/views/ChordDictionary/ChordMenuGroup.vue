<template>
  <details class="group" open>
    <summary
      class="flex items-center px-3 py-1.5 rounded-md cursor-pointer text-sm font-semibold text-base-content/70 hover:bg-base-200 list-none marker:content-['']"
    >
      <svg
        class="w-3 h-3 mr-2 transition-transform group-open:rotate-90"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
      {{ group.label }}
    </summary>
    <ul class="ml-4">
      <template v-for="child in group.items" :key="getChildKey(child)">
        <ChordMenuItem
          v-if="child.type === 'item'"
          :item="child"
          :selected="selected"
          @select="$emit('select', $event)"
        />
        <ChordMenuGroup
          v-else
          :group="child"
          :selected="selected"
          @select="$emit('select', $event)"
        />
      </template>
    </ul>
  </details>
</template>

<script setup lang="ts">
import type { ChordGroup, ChordItem } from "./utils";
import ChordMenuItem from "./ChordMenuItem.vue";
import ChordMenuGroup from "./ChordMenuGroup.vue";

defineProps<{
  group: ChordGroup;
  selected: string | null;
}>();

defineEmits<{
  (e: "select", value: string): void;
}>();

function getChildKey(child: ChordGroup | ChordItem): string {
  return child.type === "item" ? child.chordType.aliases[0] : child.value;
}
</script>
