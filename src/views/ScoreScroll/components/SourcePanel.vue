<template>
  <div class="flex flex-col gap-3">
    <!-- MusicXML 导入 -->
    <div class="rounded-xl border border-base-content/10 bg-base-200/50 p-3">
      <div class="mb-1 flex items-center justify-between">
        <span class="text-sm font-medium">
          {{ t("scoreScroll.source.musicxml") }}
        </span>
        <button
          v-if="scoreName"
          class="btn btn-ghost btn-xs"
          :title="t('scoreScroll.source.clear')"
          :aria-label="t('scoreScroll.source.clear')"
          @click="$emit('clearScore')"
        >
          <Icon name="x" :size="14" aria-hidden="true" />
        </button>
      </div>
      <p class="mb-2 text-xs text-base-content/60">
        {{ t("scoreScroll.source.musicxmlHint") }}
      </p>
      <button
        class="btn btn-sm w-full"
        :disabled="loading"
        @click="$emit('pickScore')"
      >
        <Icon name="file-music" :size="16" aria-hidden="true" />
        {{ t("scoreScroll.source.load") }}
      </button>
      <p v-if="scoreName" class="mt-2 truncate text-xs text-success">
        {{ t("scoreScroll.source.loaded", { name: scoreName }) }}
      </p>
    </div>

    <!-- 解析错误 -->
    <div v-if="errorText" class="alert alert-error py-2 px-3 text-sm">
      <Icon name="alert-circle" :size="16" aria-hidden="true" />
      <span>{{ errorText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 文件来源面板：MusicXML 导入、加载状态与错误提示 */
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";

defineProps<{
  scoreName: string | null;
  loading: boolean;
  /** 解析错误的展示文案（已本地化），为空表示无错误 */
  errorText: string;
}>();

defineEmits<{
  (e: "pickScore"): void;
  (e: "clearScore"): void;
}>();

const { t } = useI18n();
</script>
