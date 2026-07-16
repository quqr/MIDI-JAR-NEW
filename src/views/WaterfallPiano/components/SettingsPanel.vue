<template>
  <SettingsDrawer
    :model-value="modelValue"
    :title="t('WaterfallPiano.settings')"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <WaterfallSettingsContent />
  </SettingsDrawer>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import SettingsDrawer from "@/components/SettingsDrawer/SettingsDrawer.vue";
import WaterfallSettingsContent from "./WaterfallSettingsContent.vue";

defineProps<{
  modelValue: boolean;
}>();

defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const { t } = useI18n();
</script>
