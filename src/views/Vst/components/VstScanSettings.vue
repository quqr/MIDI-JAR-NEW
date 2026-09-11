<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Icon } from "@/components/Icon";
import type { SkippedPlugin } from "@/types/vst";
import type { VstScanSettingsProps } from "./props";

// ─── 底部扫描设置区（内联平铺，不进对话框） ───
// 两个平铺卡片：被跳过的插件 / 扫描目录（不使用折叠）；底部附上次扫描时间。

const props = defineProps<VstScanSettingsProps>();

const emit = defineEmits<{
  (e: "addPath"): void;
  (e: "removePath", path: string): void;
}>();

const { t } = useI18n();

function skipReasonText(skip: SkippedPlugin): string {
  const key =
    skip.reason === "crashed"
      ? "vst.skipCrashed"
      : skip.reason === "timedOut"
        ? "vst.skipTimedOut"
        : "vst.skipFailed";
  return t(key);
}

function skipTooltip(skip: SkippedPlugin): string {
  const reason = skipReasonText(skip);
  return skip.detail ? `${reason}: ${skip.detail}` : `${reason}\n${skip.path}`;
}

/** 从 Windows/Unix 路径取文件名，供跳过项显示 */
function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="grid lg:grid-cols-2 gap-3">
      <!-- 被跳过的插件（平铺展示，不折叠） -->
      <div
        v-if="props.skipped.length > 0"
        class="border border-base-300 rounded-lg bg-base-200/40 p-3"
      >
        <h3 class="text-sm font-medium mb-2">
          {{ t("vst.skippedSection", { count: props.skipped.length }) }}
        </h3>
        <div class="flex flex-col gap-1.5">
          <div
            v-for="skip in props.skipped"
            :key="skip.path"
            class="rounded-md bg-base-200/60 px-2 py-1.5"
            :title="skipTooltip(skip)"
          >
            <div class="flex items-center gap-1.5">
              <Icon
                name="alert-circle"
                :size="12"
                class="shrink-0 text-error"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate text-xs">
                {{ basename(skip.path) }}
              </span>
            </div>
            <p class="mt-0.5 text-xs text-base-content/60 break-all">
              {{ skipReasonText(skip) }}
            </p>
          </div>
        </div>
      </div>

      <!-- 扫描目录（平铺展示，不折叠） -->
      <div class="border border-base-300 rounded-lg bg-base-200/40 p-3">
        <h3 class="text-sm font-medium mb-2">{{ t("vst.scanPaths") }}</h3>
        <div class="flex flex-col gap-2">
          <ul
            v-if="props.customScanPaths.length > 0"
            class="flex flex-col gap-1"
          >
            <li
              v-for="path in props.customScanPaths"
              :key="path"
              class="flex items-center gap-1"
            >
              <span
                class="min-w-0 flex-1 truncate font-mono text-xs text-base-content/70"
                :title="path"
                >{{ path }}</span
              >
              <button
                class="btn btn-ghost btn-xs btn-square shrink-0"
                :aria-label="t('vst.removeScanPath')"
                @click="emit('removePath', path)"
              >
                <Icon name="x" :size="12" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <p v-else class="text-xs text-base-content/50">
            {{ t("vst.noCustomPaths") }}
          </p>
          <button
            class="btn btn-outline btn-xs sm:btn-sm self-start"
            :disabled="props.isAddingPath"
            @click="emit('addPath')"
          >
            <Icon name="plus" :size="14" aria-hidden="true" />
            <span>{{ t("vst.addScanPath") }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 上次扫描时间 -->
    <p v-if="props.formattedScannedAt" class="text-xs text-base-content/50">
      {{ t("vst.lastScan", { time: props.formattedScannedAt }) }}
    </p>
  </section>
</template>
