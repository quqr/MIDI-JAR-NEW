<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="modelValue" class="fixed top-0 right-0 bottom-0 z-50 flex">
        <!-- 抽屉面板 -->
        <div
          class="card bg-base-100/90 backdrop-blur-md shadow-xl border-l border-base-200/30 w-80 max-h-full overflow-y-auto rounded-none"
        >
          <!-- 标题栏 -->
          <div
            class="sticky top-0 z-10 px-4 py-3 flex items-center justify-between border-b border-base-200/30 bg-base-100/90 backdrop-blur-md"
          >
            <h2 class="text-sm font-bold">{{ title }}</h2>
            <button class="btn btn-sm btn-ghost btn-circle" @click="close">
              <Icon name="x" :size="16" />
            </button>
          </div>
          <!-- 内容区 -->
          <div class="p-4">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon/Icon.vue";

defineProps<{
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

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s ease;
}

.drawer-enter-from .card,
.drawer-leave-to .card {
  transform: translateX(100%);
}

.drawer-enter-to .card,
.drawer-leave-from .card {
  transform: translateX(0);
}
</style>
