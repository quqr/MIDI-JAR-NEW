<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useSamplerStore } from "@/stores/sampler";
import { useVstStore } from "@/stores/vst";
import { Icon } from "@/components/Icon";
import { getTauriAPI, isTauri } from "@/utils/tauri";
import { createLogger } from "@/utils/logger";
import type { ToneSource } from "@/types/vst";
import {
  VstStatusPanel,
  VstPluginLibrary,
  VstScanSettings,
} from "./components";

// ─── VST 页容器（仪表盘式布局） ───
// 结构：标题 → 浏览器降级提示 → 状态面板（一卡三区）→ 插件库分栏 →
// 扫描设置（内联折叠）→ 音源提示卡（无音源 / 采样器）。
// 数据全部来自两个 store；三个子组件只收 props、发事件。

const logger = createLogger("Vst");

const { t } = useI18n();
const samplerStore = useSamplerStore();
const vstStore = useVstStore();

const inDesktop = isTauri();

// ─── 音源来源选项（3 档：无音源 / 采样器 / VST） ───
// i18n 是响应式的，选项文案用 computed 保持语言切换即时生效。
const toneSourceOptions = computed<{ value: ToneSource; label: string }[]>(
  () => [
    { value: "none", label: t("vst.sourceNone") },
    { value: "sampler", label: t("vst.sourceSampler") },
    { value: "vst", label: t("vst.sourceVst") },
  ],
);

function onChangeToneSource(value: ToneSource) {
  if (value === samplerStore.toneSource) return;
  samplerStore.toneSource = value;

  // 切到 VST 且有选中项 → 立即加载（后端幂等，重复调用是安全的）。
  // 例外：扫描已完成且结果为空（hasScannedAndEmpty）——此时不应假装 VST 可用，
  // 保留持久化的选中项但不自动加载，由空态提示与"重新扫描/添加目录"接管；
  // 首次启动（尚未扫描）与老用户的持久化选择不受影响。
  if (
    value === "vst" &&
    vstStore.selectedPluginPath &&
    !vstStore.hasScannedAndEmpty
  ) {
    void vstStore.selectPlugin(vstStore.selectedPluginPath, true).catch(() => {
      // 错误已记录到 vstStore.loadError，由状态面板就地呈现
    });
  }
}

function onToggleEditor() {
  if (vstStore.pluginInfo?.editorOpen) {
    void vstStore.closeEditor();
  } else {
    void vstStore.openEditor();
  }
}

async function onSelectPlugin(path: string) {
  try {
    await vstStore.selectPlugin(path, true);
  } catch (err) {
    logger.warn("[Vst] load failed: %s", err);
  }
}

// ─── 扫描目录 ───
const isAdding = ref(false);

async function onAddScanPath() {
  if (!inDesktop) return;
  isAdding.value = true;
  try {
    const dir = await getTauriAPI().fileSystem.openDirectoryDialog();
    if (!dir) return;
    await vstStore.addScanPath(dir);
    await vstStore.scan();
  } catch (err) {
    logger.warn("[Vst] addScanPath failed: %s", err);
  } finally {
    isAdding.value = false;
  }
}

// ─── 派生展示 ───
const formattedScannedAt = computed(() => {
  if (!vstStore.scannedAt) return "";
  return new Date(vstStore.scannedAt).toLocaleString();
});
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div
      class="w-full max-w-6xl mx-auto px-4 py-5 sm:px-6 flex flex-col gap-4 sm:gap-5"
    >
      <!-- ===== 标题行 ===== -->
      <header class="flex flex-wrap items-center gap-3">
        <div
          class="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon name="plugin" :size="22" />
        </div>
        <div class="min-w-0">
          <h1 class="text-xl font-bold leading-tight">
            {{ t("vst.title") }}
          </h1>
          <p class="text-sm text-base-content/60 mt-0.5">
            {{ t("vst.subtitle") }}
          </p>
        </div>
      </header>

      <!-- ===== 浏览器环境：桌面端专属 ===== -->
      <div
        v-if="!inDesktop"
        class="alert alert-info items-start gap-2"
        role="note"
      >
        <Icon name="info" :size="18" aria-hidden="true" />
        <div class="flex flex-col gap-0.5">
          <span class="font-medium">{{ t("vst.desktopOnly") }}</span>
          <span class="text-xs opacity-80">{{ t("vst.desktopOnlyHint") }}</span>
        </div>
      </div>

      <template v-else>
        <!-- ===== 顶部状态面板：音源 3 档 + 当前插件 + 操作 ===== -->
        <VstStatusPanel
          :tone-source="samplerStore.toneSource"
          :tone-source-options="toneSourceOptions"
          :status="vstStore.status"
          :plugin-info="vstStore.pluginInfo"
          :is-loading="vstStore.loadingPluginPath !== null"
          :has-selection="vstStore.selectedPluginPath !== null"
          @change-tone-source="onChangeToneSource"
          @reload="vstStore.reload()"
          @toggle-editor="onToggleEditor"
          @unload="vstStore.unload()"
        />

        <!-- ===== 插件库分栏 + 扫描设置（仅切到 VST 时） ===== -->
        <template v-if="samplerStore.toneSource === 'vst'">
          <VstPluginLibrary
            :plugins="vstStore.plugins"
            :selected-plugin-path="vstStore.selectedPluginPath"
            :loading-plugin-path="vstStore.loadingPluginPath"
            :is-running="vstStore.isRunning"
            :is-scanning="vstStore.isScanning"
            :scan-error="vstStore.scanError"
            :load-error="vstStore.loadError"
            @select="onSelectPlugin"
            @rescan="vstStore.scan()"
          />

          <VstScanSettings
            :skipped="vstStore.skipped"
            :custom-scan-paths="vstStore.customScanPaths"
            :is-adding-path="isAdding"
            :formatted-scanned-at="formattedScannedAt"
            @add-path="onAddScanPath"
            @remove-path="vstStore.removeScanPath($event)"
          />
        </template>

        <!-- ===== 无音源提示（仅 toneSource === 'none'） ===== -->
        <section
          v-if="samplerStore.toneSource === 'none'"
          class="card bg-base-100 border border-base-300"
        >
          <div class="card-body p-5 flex-row items-center gap-3">
            <Icon
              name="midi-error"
              :size="20"
              class="text-base-content/50 shrink-0"
              aria-hidden="true"
            />
            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
              <span class="font-medium text-sm">{{
                t("vst.noSourceTitle")
              }}</span>
              <span class="text-xs text-base-content/60">{{
                t("vst.noSourceHint")
              }}</span>
            </div>
          </div>
        </section>

        <!-- ===== 内置采样器提示（仅切到采样器时） ===== -->
        <section
          v-else-if="samplerStore.toneSource === 'sampler'"
          class="card bg-base-100 border border-base-300"
        >
          <div class="card-body p-5 flex-row items-center gap-3">
            <Icon
              name="speaker"
              :size="20"
              class="text-primary shrink-0"
              aria-hidden="true"
            />
            <p class="text-sm text-base-content/70 min-w-0 flex-1">
              {{ t("vst.usingSampler") }}
            </p>
            <RouterLink to="/sampler" class="btn btn-outline btn-sm shrink-0">
              {{ t("vst.goSampler") }}
            </RouterLink>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
