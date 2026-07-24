<template>
  <label
    :for="toggleId"
    class="flex items-center justify-between py-2.5 cursor-pointer"
  >
    <div class="flex-1 min-w-0">
      <span class="text-sm">{{ label }}</span>
      <span
        v-if="description"
        class="text-xs text-base-content/70 block mt-0.5"
      >
        {{ description }}
      </span>
    </div>
    <div class="flex items-center gap-2 flex-shrink-0 ml-4">
      <input
        :id="toggleId"
        type="checkbox"
        class="toggle"
        :class="{ loading: loading }"
        :checked="modelValue"
        :disabled="disabled || loading"
        :aria-label="label"
        @change="
          $emit(
            'update:modelValue',
            ($event.target as HTMLInputElement).checked,
          )
        "
      />
      <span
        v-if="loading"
        class="loading loading-spinner loading-xs text-primary"
      ></span>
    </div>
  </label>
</template>

<script setup lang="ts">
import { useId } from "vue";

const id = useId();
const toggleId = `toggle-${id}`;

interface Props {
  modelValue: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  loading?: boolean;
}

defineProps<Props>();

defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>
