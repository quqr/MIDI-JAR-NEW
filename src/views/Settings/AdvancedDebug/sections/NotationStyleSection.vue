<template>
  <NotationFieldGroup
    group="style"
    variant="debug"
    :model-value="modelValue"
    :title-key="'advancedDebug.notation.style.title'"
    :i18n-prefix="'advancedDebug.notation.style'"
    :open="open"
    :section-id="sectionId"
    :search-query="searchQuery"
    @update="onUpdate"
    @update:open="$emit('update:open', $event)"
  />
</template>

<script setup lang="ts">
import NotationFieldGroup from "@/components/Notation/NotationFieldGroup.vue";
import type { NotationStyleConfig } from "@/components/Notation/types";

interface Props {
  modelValue: NotationStyleConfig;
  /** 外部控制展开状态（v-model:open） */
  open?: boolean;
  /** 唯一标识，用于搜索过滤 */
  sectionId?: string;
  /** 搜索关键词，非空时仅当标题匹配才显示 */
  searchQuery?: string;
}

withDefaults(defineProps<Props>(), {
  open: undefined,
  sectionId: undefined,
  searchQuery: "",
});

const emit = defineEmits<{
  (
    e: "update",
    key: keyof Omit<NotationStyleConfig, "layoutDimensions">,
    value: string | number | null,
  ): void;
  (e: "update:open", value: boolean): void;
}>();

function onUpdate(key: string, value: boolean | number | string | null) {
  emit(
    "update",
    key as keyof Omit<NotationStyleConfig, "layoutDimensions">,
    value as string | number | null,
  );
}
</script>
