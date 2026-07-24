<template>
  <div
    class="collapse collapse-arrow bg-base-100 border border-base-300 rounded-hig-lg mb-3"
    :class="{ 'collapse-open': isOpen }"
    :data-section-id="sectionId"
  >
    <div
      class="collapse-title text-base font-semibold flex items-center gap-2 cursor-pointer"
      @click="toggle"
    >
      <Icon v-if="icon" :name="icon" :size="18" class="text-base-content/70" />
      <span>{{ title }}</span>
      <span
        v-if="badge"
        class="badge badge-sm badge-ghost ml-auto mr-4 text-xs font-normal"
      >
        {{ badge }}
      </span>
    </div>
    <div class="collapse-content pt-2 pb-1">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useId } from "vue";
import type { IconName } from "@/components/Icon/types";
import Icon from "@/components/Icon/Icon.vue";

interface Props {
  title: string;
  defaultOpen?: boolean;
  badge?: string | number;
  icon?: IconName;
  /** 外部控制展开状态（v-model:open）。不传则使用内部状态 */
  open?: boolean;
  /** 用于搜索过滤匹配的唯一标识 */
  sectionId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpen: true,
  badge: "",
  open: undefined,
  sectionId: undefined,
});

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const internalOpen = ref(props.defaultOpen);
const id = useId();
const fallbackSectionId = `section-${id}`;

const sectionId = computed(() => props.sectionId ?? fallbackSectionId);

// 是否受控
const isControlled = computed(() => props.open !== undefined);

const isOpen = computed({
  get: () =>
    isControlled.value ? (props.open as boolean) : internalOpen.value,
  set: (val: boolean) => {
    if (isControlled.value) {
      emit("update:open", val);
    } else {
      internalOpen.value = val;
    }
  },
});

// 监听 defaultOpen 变化（仅在非受控模式下生效）
watch(
  () => props.defaultOpen,
  (val) => {
    if (!isControlled.value) internalOpen.value = val;
  },
);

function toggle(e: MouseEvent) {
  e.preventDefault();
  isOpen.value = !isOpen.value;
}
</script>
