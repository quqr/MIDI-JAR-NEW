<template>
  <div
    class="collapse shadow-xl collapse-arrow bg-base-200/50 border border-base-200 rounded-xl mb-3"
    :class="{ 'collapse-open': isOpen }"
  >
    <div
      class="collapse-title text-base font-semibold flex items-center gap-2 cursor-pointer"
      @click="toggle"
    >
      <Icon v-if="icon" :name="icon" :size="18" class="text-base-content/60" />
      <span>{{ title }}</span>
    </div>
    <div v-if="isOpen" class="collapse-content pt-2 pb-1">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { IconName } from "@/components/Icon/types";
import Icon from "@/components/Icon/Icon.vue";

interface Props {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  icon?: IconName;
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpen: true,
  badge: "",
});

const isOpen = ref(props.defaultOpen);

// 监听 defaultOpen 变化（虽然不常见）
watch(
  () => props.defaultOpen,
  (val) => {
    isOpen.value = val;
  },
);

function toggle(e: MouseEvent) {
  e.preventDefault();
  isOpen.value = !isOpen.value;
}
</script>
