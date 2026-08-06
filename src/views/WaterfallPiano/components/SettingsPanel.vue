<template>
  <Teleport to="body">
    <template v-if="modelValue">
      <div class="drawer-overlay-fixed" @click="close"></div>
      <aside
        class="drawer-panel-fixed drawer-panel-right"
        style="width: 384px"
      >
        <div
          class="flex flex-col flex-1 min-h-0"
          role="dialog"
          aria-modal="false"
          :aria-label="t('WaterfallPiano.settings')"
        >
          <!-- 标题栏 -->
          <div
            class="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-base-300"
          >
            <h2 class="text-hig-lg font-bold">
              {{ t("WaterfallPiano.settings") }}
            </h2>
            <button
              class="btn btn-sm btn-ghost btn-circle tooltip tooltip-bottom"
              :data-tip="t('common.close')"
              :aria-label="t('common.close')"
              @click="close"
            >
              <Icon name="x" :size="16" aria-hidden="true" />
            </button>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto p-4">
            <WaterfallSettingsContent />
          </div>
        </div>
      </aside>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import WaterfallSettingsContent from "./WaterfallSettingsContent.vue";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const { t } = useI18n();

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
.drawer-overlay-fixed {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background-color: rgb(0 0 0 / 0.4);
}

.drawer-panel-fixed {
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: var(--z-drawer);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: color-mix(in oklch, var(--color-base-100) 80%, transparent);
  box-shadow: var(--shadow-hig-xl);
}

.drawer-panel-right {
  right: 0;
  border-left: 1px solid
    color-mix(in oklch, var(--color-base-content) 8%, transparent);
}
</style>
