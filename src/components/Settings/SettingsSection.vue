<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex-grow-1 overflow-y-auto p-4">
      <div
        v-if="showResetSuccess"
        class="alert alert-success alert-sm mb-4 py-2 px-3"
      >
        <Icon
          name="check-circle"
          class="stroke-current flex-shrink-0 h-4 w-4"
          :size="16"
        />
        <span class="text-sm">{{ t("common.resetSuccess") }}</span>
      </div>
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";

const { t } = useI18n();

const showResetSuccess = ref(false);
</script>
