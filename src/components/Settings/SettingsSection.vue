<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex-grow-1 overflow-y-auto p-4">
      <div
        v-if="showResetSuccess"
        class="alert alert-success alert-sm mb-4 py-2 px-3"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="stroke-current flex-shrink-0 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span class="text-sm">{{ t("common.resetSuccess") }}</span>
      </div>
      <slot></slot>
    </div>
    <div v-if="showReset" class="flex items-center border-t px-2 py-1 gap-2">
      <slot name="actions"></slot>
      <button
        class="btn btn-sm btn-outline"
        :class="{ loading: resetLoading }"
        :disabled="resetLoading"
        @click="handleReset"
      >
        {{ t("common.resetToDefaults") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  showReset?: boolean;
  onReset?: () => void;
  resetLoading?: boolean;
}

const {
  showReset = true,
  onReset = () => {},
  resetLoading = false,
} = defineProps<Props>();
const { t } = useI18n();

const showResetSuccess = ref(false);

const handleReset = () => {
  onReset();
  showResetSuccess.value = true;
  setTimeout(() => {
    showResetSuccess.value = false;
  }, 3000);
};
</script>
