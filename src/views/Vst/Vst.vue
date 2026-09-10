<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useSamplerStore } from "@/stores/sampler";
import { useVstStore } from "@/stores/vst";
import RangeSlider from "@/components/common/RangeSlider.vue";
import type { RangeSliderValue } from "@/components/common/rangeSlider";
import { optionIndexOf } from "@/components/common/rangeSlider";
import { Icon } from "@/components/Icon";
import StateDot from "@/components/common/StateDot.vue";
import { getTauriAPI, isTauri } from "@/utils/tauri";
import { createLogger } from "@/utils/logger";
import type { ScannedPlugin, SkippedPlugin, ToneSource } from "@/types/vst";

const logger = createLogger("Vst");

const { t } = useI18n();
const samplerStore = useSamplerStore();
const vstStore = useVstStore();

const inDesktop = isTauri();

// ─── 音源来源切换（ADR 0014：离散选项一律用 RangeSlider） ───
const toneSourceOptions: { value: ToneSource; label: string }[] = [
  { value: "sampler", label: t("vst.sourceSampler") },
  { value: "vst", label: t("vst.sourceVst") },
];
const toneSourceLabels = toneSourceOptions.map((o) => o.label);
const toneSourceIndex = computed(() =>
  Math.max(0, optionIndexOf(toneSourceOptions, samplerStore.toneSource)),
);
const toneSourceHint = computed(() =>
  samplerStore.toneSource === "vst"
    ? t("vst.toneSourceHintVst")
    : t("vst.toneSourceHintSampler"),
);

function onToneSourceSlide(value: RangeSliderValue) {
  const option = toneSourceOptions[Number(value)];
  if (!option || option.value === samplerStore.toneSource) return;
  samplerStore.toneSource = option.value;

  // 切到 VST 且有选中项 → 立即加载（后端幂等，重复调用是安全的）
  if (option.value === "vst" && vstStore.selectedPluginPath) {
    void vstStore.selectPlugin(vstStore.selectedPluginPath, true).catch(() => {
      // 错误已记录到 vstStore.loadError，由状态卡就地呈现
    });
  }
}

// ─── 插件库 ───
const usableCount = computed(
  () => vstStore.plugins.filter((p) => vstStore.isPluginUsable(p)).length,
);

async function handleSelectPlugin(plugin: ScannedPlugin) {
  if (!vstStore.isPluginUsable(plugin)) return;
  try {
    await vstStore.selectPlugin(plugin.path, true);
  } catch (err) {
    logger.warn("[Vst] load failed: %s", err);
  }
}

function pluginTooltip(plugin: ScannedPlugin): string {
  if (!vstStore.isPluginUsable(plugin)) {
    if (!plugin.hasMidiInput) return t("vst.disabledNoMidi");
    if (plugin.audioOutputs === 0) return t("vst.disabledNoOutput");
  }
  return plugin.path;
}

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

// ─── 自定义目录 ───
const isAdding = ref(false);

async function handleAddScanPath() {
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
      class="w-full max-w-5xl mx-auto px-4 py-5 sm:px-6 flex flex-col gap-4 sm:gap-5"
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
        <!-- ===== 音源来源 ===== -->
        <section class="card bg-base-100 border border-base-300">
          <div class="card-body p-5 gap-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <h2 class="font-semibold">
                  {{ t("vst.toneSource") }}
                </h2>
                <p class="text-xs text-base-content/60 mt-0.5">
                  {{ toneSourceHint }}
                </p>
              </div>
              <!-- 后端状态徽标：仅 VST 激活时有意义 -->
              <div
                v-if="samplerStore.toneSource === 'vst'"
                class="badge gap-1.5"
                :class="{
                  'badge-success': vstStore.isRunning,
                  'badge-error': vstStore.hasError,
                  'badge-ghost': !vstStore.isRunning && !vstStore.hasError,
                }"
              >
                <StateDot
                  :status="
                    vstStore.isRunning
                      ? 'success'
                      : vstStore.hasError
                        ? 'error'
                        : 'neutral'
                  "
                  size="xs"
                />
                <span>{{
                  vstStore.isRunning
                    ? t("vst.stateRunning")
                    : vstStore.hasError
                      ? t("vst.stateError")
                      : t("vst.stateIdle")
                }}</span>
              </div>
            </div>
            <RangeSlider
              :model-value="toneSourceIndex"
              :min="0"
              :max="toneSourceOptions.length - 1"
              :step="1"
              no-fill
              :tick-labels="toneSourceLabels"
              color="primary"
              :aria-label="t('vst.toneSource')"
              @update:model-value="onToneSourceSlide"
            />
          </div>
        </section>

        <!-- ===== VST 内容区（仅切到 VST 时） ===== -->
        <template v-if="samplerStore.toneSource === 'vst'">
          <!-- 当前插件状态卡 -->
          <section class="card bg-base-100 border border-base-300">
            <div class="card-body p-5 gap-3">
              <h2 class="font-semibold">
                {{ t("vst.currentPlugin") }}
              </h2>

              <!-- 错误态：崩溃 / 加载失败（就地常驻） -->
              <div
                v-if="vstStore.hasError"
                class="alert alert-error items-start gap-2"
                role="alert"
              >
                <Icon name="alert-circle" :size="18" aria-hidden="true" />
                <div class="flex min-w-0 flex-1 flex-col gap-2">
                  <span class="font-medium">{{ t("vst.crashed") }}</span>
                  <span
                    v-if="vstStore.errorMessage"
                    class="text-xs break-all opacity-80"
                  >
                    {{ vstStore.errorMessage }}
                  </span>
                  <button
                    class="btn btn-error btn-xs sm:btn-sm self-start"
                    :disabled="!vstStore.selectedPluginPath"
                    @click="vstStore.reload()"
                  >
                    <Icon name="refresh" :size="14" aria-hidden="true" />
                    <span>{{ t("vst.reload") }}</span>
                  </button>
                </div>
              </div>

              <!-- 运行态：插件信息 + 编辑器/卸载操作 -->
              <div
                v-else-if="vstStore.isRunning && vstStore.pluginInfo"
                class="flex items-center gap-3 flex-wrap"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <StateDot status="success" size="sm" />
                    <span class="font-medium truncate">{{
                      vstStore.pluginInfo.name
                    }}</span>
                    <span
                      v-if="vstStore.pluginInfo.audioRunning"
                      class="badge badge-success badge-outline badge-xs"
                    >
                      {{ t("vst.audioRunning") }}
                    </span>
                  </div>
                  <p
                    class="text-xs text-base-content/60 truncate mt-0.5"
                    :title="vstStore.pluginInfo.path"
                  >
                    {{ vstStore.pluginInfo.vendor }}
                    <template v-if="vstStore.pluginInfo.vendor">·</template>
                    {{ vstStore.pluginInfo.path }}
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    class="btn btn-outline btn-xs sm:btn-sm"
                    @click="
                      vstStore.pluginInfo?.editorOpen
                        ? vstStore.closeEditor()
                        : vstStore.openEditor()
                    "
                  >
                    <Icon name="window" :size="14" aria-hidden="true" />
                    <span>{{
                      vstStore.pluginInfo.editorOpen
                        ? t("vst.closeEditor")
                        : t("vst.openEditor")
                    }}</span>
                  </button>
                  <button
                    class="btn btn-ghost btn-xs sm:btn-sm text-error"
                    @click="vstStore.unload()"
                  >
                    <Icon name="power" :size="14" aria-hidden="true" />
                    <span>{{ t("vst.unload") }}</span>
                  </button>
                </div>
              </div>

              <!-- 加载中 -->
              <div
                v-else-if="vstStore.loadingPluginPath"
                class="flex items-center gap-2 text-sm text-base-content/70"
              >
                <span class="loading loading-spinner loading-sm"></span>
                <span>{{ t("vst.loading") }}</span>
              </div>

              <!-- 空态 -->
              <p v-else class="text-sm text-base-content/60">
                {{ t("vst.noPluginSelected") }}
              </p>
            </div>
          </section>

          <!-- 插件库 -->
          <section class="card bg-base-100 border border-base-300">
            <div class="card-body p-5 gap-4">
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold flex items-center gap-2">
                  {{ t("vst.library") }}
                  <span
                    v-if="usableCount > 0"
                    class="badge badge-ghost badge-sm"
                  >
                    {{ t("vst.pluginCount", { count: usableCount }) }}
                  </span>
                </h2>
                <button
                  class="btn btn-ghost btn-sm"
                  :disabled="vstStore.isScanning"
                  :title="t('vst.rescan')"
                  :aria-label="t('vst.rescan')"
                  @click="vstStore.scan()"
                >
                  <Icon
                    name="refresh"
                    :size="16"
                    :class="{ 'animate-spin': vstStore.isScanning }"
                    aria-hidden="true"
                  />
                  <span class="hidden sm:inline">{{ t("vst.rescan") }}</span>
                </button>
              </div>

              <!-- 扫描中 -->
              <div
                v-if="vstStore.isScanning"
                class="flex items-center gap-2 py-4 text-sm text-base-content/70"
              >
                <span class="loading loading-spinner loading-sm"></span>
                <span>{{ t("vst.scanning") }}</span>
              </div>

              <!-- 扫描器本身失败——区别于"没有装插件" -->
              <div
                v-else-if="vstStore.scanError"
                class="alert alert-error items-start gap-2 text-sm"
                role="alert"
              >
                <Icon name="alert-circle" :size="16" aria-hidden="true" />
                <div class="flex flex-col gap-1">
                  <span>{{ t("vst.scanFailed") }}</span>
                  <span class="break-all opacity-80">{{
                    vstStore.scanError
                  }}</span>
                </div>
              </div>

              <!-- 空态 -->
              <p
                v-else-if="
                  vstStore.plugins.length === 0 && vstStore.skipped.length === 0
                "
                class="py-4 text-sm text-base-content/60"
              >
                {{ t("vst.noPlugins") }}
              </p>

              <!-- 插件卡片网格 -->
              <div v-else class="flex flex-col gap-4">
                <div
                  class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                >
                  <button
                    v-for="plugin in vstStore.plugins"
                    :key="plugin.path"
                    class="card bg-base-100 border text-left duration-150"
                    :class="[
                      vstStore.selectedPluginPath === plugin.path &&
                      vstStore.isRunning
                        ? 'border-success/60 ring-1 ring-success'
                        : vstStore.selectedPluginPath === plugin.path
                          ? 'border-primary/60 ring-1 ring-primary'
                          : 'border-base-300 hover:border-primary/50',
                      !vstStore.isPluginUsable(plugin)
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer',
                    ]"
                    :disabled="
                      !vstStore.isPluginUsable(plugin) ||
                      vstStore.loadingPluginPath === plugin.path
                    "
                    :title="pluginTooltip(plugin)"
                    @click="handleSelectPlugin(plugin)"
                  >
                    <div class="card-body p-3 gap-1.5">
                      <div class="flex items-start gap-2">
                        <div class="min-w-0 flex-1">
                          <div class="truncate text-sm font-medium">
                            {{ plugin.name }}
                          </div>
                          <div
                            class="truncate text-xs text-base-content/60 mt-0.5"
                          >
                            {{ plugin.vendor }}
                            <template v-if="plugin.version"
                              >· {{ plugin.version }}</template
                            >
                          </div>
                        </div>
                        <!-- 加载中 -->
                        <span
                          v-if="vstStore.loadingPluginPath === plugin.path"
                          class="loading loading-spinner loading-xs shrink-0"
                        ></span>
                        <!-- 运行中 -->
                        <span
                          v-else-if="
                            vstStore.selectedPluginPath === plugin.path &&
                            vstStore.isRunning
                          "
                          class="shrink-0"
                        >
                          <StateDot status="success" size="xs" />
                        </span>
                        <!-- 不可用 -->
                        <Icon
                          v-else-if="!vstStore.isPluginUsable(plugin)"
                          name="lock"
                          :size="14"
                          class="shrink-0 text-base-content/50"
                          aria-hidden="true"
                        />
                      </div>
                      <div class="flex flex-wrap gap-1 mt-0.5">
                        <span
                          v-if="plugin.category"
                          class="badge badge-ghost badge-xs"
                        >
                          {{ plugin.category }}
                        </span>
                        <span class="badge badge-ghost badge-xs">
                          {{
                            t("vst.badgeAudioOuts", {
                              count: plugin.audioOutputs,
                            })
                          }}
                        </span>
                        <span
                          v-if="plugin.hasGui"
                          class="badge badge-ghost badge-xs"
                        >
                          GUI
                        </span>
                      </div>
                    </div>
                  </button>
                </div>

                <!-- 统计行 + 折叠区 -->
                <div class="grid lg:grid-cols-2 gap-3">
                  <!-- 被跳过的插件 -->
                  <details
                    v-if="vstStore.skipped.length > 0"
                    class="collapse-arrow collapse border border-base-300 rounded-lg bg-base-200/40"
                  >
                    <summary class="collapse-title min-h-0 py-2.5 text-sm">
                      {{
                        t("vst.skippedSection", {
                          count: vstStore.skipped.length,
                        })
                      }}
                    </summary>
                    <div class="collapse-content flex flex-col gap-1.5 px-1">
                      <div
                        v-for="skip in vstStore.skipped"
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
                        <p
                          class="mt-0.5 text-xs text-base-content/60 break-all"
                        >
                          {{ skipReasonText(skip) }}
                        </p>
                      </div>
                    </div>
                  </details>

                  <!-- 扫描目录 -->
                  <details
                    class="collapse-arrow collapse border border-base-300 rounded-lg bg-base-200/40"
                  >
                    <summary class="collapse-title min-h-0 py-2.5 text-sm">
                      {{ t("vst.scanPaths") }}
                    </summary>
                    <div class="collapse-content flex flex-col gap-2 px-1">
                      <ul
                        v-if="vstStore.customScanPaths.length > 0"
                        class="flex flex-col gap-1"
                      >
                        <li
                          v-for="path in vstStore.customScanPaths"
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
                            @click="vstStore.removeScanPath(path)"
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
                        :disabled="isAdding"
                        @click="handleAddScanPath"
                      >
                        <Icon name="plus" :size="14" aria-hidden="true" />
                        <span>{{ t("vst.addScanPath") }}</span>
                      </button>
                    </div>
                  </details>
                </div>

                <!-- 上次扫描时间 -->
                <p
                  v-if="vstStore.scannedAt"
                  class="text-xs text-base-content/50"
                >
                  {{ t("vst.lastScan", { time: formattedScannedAt }) }}
                </p>
              </div>
            </div>
          </section>
        </template>

        <!-- ===== 内置采样器提示（仅切到采样器时） ===== -->
        <section
          v-else
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
