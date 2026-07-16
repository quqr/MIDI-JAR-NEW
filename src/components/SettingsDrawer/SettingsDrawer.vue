<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="modelValue"
        class="fixed top-0 right-0 bottom-0 z-50 flex"
        role="dialog"
        aria-modal="false"
        :aria-label="title"
      >
        <div
          class="card bg-base-100/90 backdrop-blur-md shadow-xl border-l border-base-200/30 w-96 max-w-[calc(100vw-1rem)] max-h-full overflow-y-auto rounded-none"
        >
          <div
            class="sticky top-0 z-10 px-4 py-3 flex items-center justify-between border-b border-base-200/30 bg-base-100/90 backdrop-blur-md"
          >
            <h2 class="text-lg font-bold">{{ title }}</h2>
            <button
              class="btn btn-sm btn-ghost btn-circle tooltip tooltip-bottom"
              :data-tip="t('common.close')"
              @click="close"
            >
              <Icon name="x" :size="16" />
            </button>
          </div>
          <div class="overflow-y-auto p-4">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";

const { t } = useI18n();

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

function onEsc(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  const target = e.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return;
  }
  close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      window.addEventListener("keydown", onEsc);
    } else {
      window.removeEventListener("keydown", onEsc);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  window.removeEventListener("keydown", onEsc);
});
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
