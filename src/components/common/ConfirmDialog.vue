<template>
  <dialog
    v-if="modelValue"
    ref="dialogRef"
    open
    class="modal modal-open"
    :aria-labelledby="titleId"
    @click.self="onCancel"
  >
    <div class="modal-box">
      <h3 :id="titleId" class="font-bold text-lg">{{ title }}</h3>
      <p class="py-4 text-base-content/80">{{ message }}</p>
      <div class="modal-action">
        <button class="btn btn-sm" :aria-label="cancelText" @click="onCancel">
          {{ cancelText }}
        </button>
        <button
          class="btn btn-sm"
          :class="variant === 'error' ? 'btn-error' : 'btn-primary'"
          :aria-label="confirmText"
          @click="onConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button :aria-label="t('common.close')" @click="onCancel"></button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch, useId, computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "primary" | "error";
  }>(),
  {
    confirmLabel: undefined,
    cancelLabel: undefined,
    variant: "primary",
  },
);

const confirmText = computed(() => props.confirmLabel ?? t("common.confirm"));
const cancelText = computed(() => props.cancelLabel ?? t("common.cancel"));

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
  cancel: [];
}>();

const dialogRef = ref<HTMLDialogElement>();
const titleId = useId();

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      // 打开时聚焦确认按钮（此处用延时等待 DOM 渲染）
      setTimeout(() => {
        dialogRef.value?.focus();
      }, 50);
    }
  },
);

function onConfirm() {
  emit("confirm");
  emit("update:modelValue", false);
}

function onCancel() {
  emit("cancel");
  emit("update:modelValue", false);
}
</script>
