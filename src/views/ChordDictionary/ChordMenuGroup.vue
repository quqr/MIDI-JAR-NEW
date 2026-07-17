<template>
  <details
    ref="detailsRef"
    class="group"
    open
    @toggle="isOpen = detailsRef?.open ?? true"
  >
    <summary
      role="treeitem"
      tabindex="0"
      :aria-expanded="isOpen"
      :class="[
        'flex items-center px-3 py-1.5 rounded-lg cursor-pointer text-sm font-semibold text-base-content/70 hover:bg-base-300 list-none marker:content-[\'\'] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-full',
        bgClass,
      ]"
    >
      <Icon
        name="angle-right"
        class="w-3 h-3 mr-2 transition-transform group-open:rotate-90"
        :size="12"
      />
      {{ group.label }}
    </summary>
    <ul class="ml-4" role="group">
      <template v-for="child in group.items" :key="getChildKey(child)">
        <ChordMenuItem
          v-if="child.type === 'item'"
          :item="child"
          :selected="selected"
          @select="$emit('select', $event)"
        />
        <!-- 递归组件，传递 depth + 1 -->
        <ChordMenuGroup
          v-else
          :group="child"
          :selected="selected"
          :depth="depth + 1"
          @select="$emit('select', $event)"
        />
      </template>
    </ul>
  </details>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { ChordGroup, ChordItem } from "./utils";
import ChordMenuItem from "./ChordMenuItem.vue";
import Icon from "@/components/Icon/Icon.vue";

// 定义 props，包含 depth，默认为 0
const props = withDefaults(
  defineProps<{
    group: ChordGroup;
    selected: string | null;
    depth?: number;
  }>(),
  {
    depth: 0,
  }
);

defineEmits<{
  (e: "select", value: string): void;
}>();

const detailsRef = ref<HTMLDetailsElement | null>(null);
const isOpen = ref(true);

// 根据嵌套深度计算不同的背景色
const bgClass = computed(() => {
  const colors = [
    "bg-base-300/90", 
    "bg-base-300/70", 
    "bg-base-300/50", 
    "bg-base-300/30", 
    "bg-base-300/10", 
    "bg-base-300", 
  ];
  return colors[props.depth] || colors[0];
});

function getChildKey(child: ChordGroup | ChordItem): string {
  return child.type === "item" ? child.chordType.aliases[0] : child.value;
}
</script>