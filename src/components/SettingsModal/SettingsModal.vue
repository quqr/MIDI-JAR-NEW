<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="close"
    >
      <div
        class="card bg-base-100 shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden mx-4"
      >
        <div
          class="card-title p-4 flex items-center justify-between border-b border-base-200"
        >
          <h2 class="text-lg font-bold">{{ title }}</h2>
          <button class="btn btn-sm btn-ghost btn-circle" @click="close">
            <Icon name="x" :size="16" />
          </button>
        </div>
        <div class="overflow-auto max-h-[calc(90vh-73px)]">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon/Icon.vue";

const props = defineProps<{
  modelValue: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

function close() {
  emit("update:modelValue", false);
}
</script>
