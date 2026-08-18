<template>
  <Teleport to="body">
    <template v-if="modelValue">
      <div class="fixed inset-0 z-overlay bg-black/40" @click="close"></div>
      <aside
        class="fixed top-0 bottom-0 right-0 z-drawer flex flex-col overflow-hidden bg-base-100/80 shadow-xl border-l border-base-content/10"
        style="width: 384px"
      >
        <div
          class="flex flex-col flex-1 min-h-0"
          role="dialog"
          aria-modal="false"
          :aria-label="t('WaterfallPiano.settings')"
        >
          <PageHeader :title="t('WaterfallPiano.settings')">
            <template #actions>
              <button
                class="btn btn-sm btn-ghost btn-circle tooltip tooltip-bottom"
                :data-tip="t('common.close')"
                :aria-label="t('common.close')"
                @click="close"
              >
                <Icon name="x" :size="16" aria-hidden="true" />
              </button>
            </template>
          </PageHeader>
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
import PageHeader from "@/components/common/PageHeader.vue";
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
