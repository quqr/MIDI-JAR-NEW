<template>
  <div class="flex items-center justify-between py-2.5">
    <div class="flex-1 min-w-0">
      <span v-if="label" :id="colorLabelId" class="text-sm">{{ label }}</span>
      <span
        v-if="description"
        class="text-xs text-base-content/70 block mt-0.5"
      >
        {{ description }}
      </span>
    </div>
    <ColorPicker
      class="flex-shrink-0 ml-4"
      :model-value="modelValue"
      :alpha="alpha"
      :disabled="disabled"
      :aria-label="label"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from "vue";
import ColorPicker from "@/components/common/ColorPicker.vue";

const id = useId();
const colorLabelId = `color-label-${id}`;

interface Props {
  modelValue: string | null;
  label?: string;
  description?: string;
  disabled?: boolean;
  /** 是否启用透明度通道（默认开启；仅在实际 a<1 时输出 8 位 hex） */
  alpha?: boolean;
}

withDefaults(defineProps<Props>(), {
  label: undefined,
  description: undefined,
  disabled: false,
  alpha: true,
});
defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>
