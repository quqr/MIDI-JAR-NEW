<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "@/components/Icon";
import StateDot from "@/components/common/StateDot.vue";
import { useVstStore } from "@/stores/vst";
import type { ScannedPlugin } from "@/types/vst";
import type { VstPluginLibraryProps } from "./props";

// ─── 插件库分栏（左列表 + 右详情，`lg:grid-cols-[320px_1fr]`） ───
// 左列：搜索框 + 可滚动插件列表（选中高亮、加载状态标记）；
// 右列：选中插件详情（元信息、加载按钮、错误详情）。移动端退化为单列堆叠。

const props = defineProps<VstPluginLibraryProps>();

const emit = defineEmits<{
  (e: "select", path: string): void;
  (e: "rescan"): void;
}>();

const { t } = useI18n();
const vstStore = useVstStore();

const searchQuery = ref("");

/** 按名称/厂商过滤（大小写不敏感）；空串返回原列表 */
const filteredPlugins = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.plugins;
  return props.plugins.filter(
    (p) =>
      p.name.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q),
  );
});

const usableCount = computed(
  () => props.plugins.filter((p) => vstStore.isPluginUsable(p)).length,
);

/** 右列详情对象：当前选中项（路径失效时回落为空） */
const detailPlugin = computed<ScannedPlugin | null>(() => {
  if (!props.selectedPluginPath) return null;
  return props.plugins.find((p) => p.path === props.selectedPluginPath) ?? null;
});

/** 详情区的加载失败（只对选中项生效） */
const detailLoadError = computed(() => {
  if (
    props.loadError &&
    detailPlugin.value &&
    props.loadError.path === detailPlugin.value.path
  ) {
    return props.loadError;
  }
  return null;
});

/** 列表项状态徽标 */
type ItemState = "running" | "loading" | "error" | "disabled" | "idle";

function itemState(plugin: ScannedPlugin): ItemState {
  if (props.selectedPluginPath === plugin.path && props.isRunning)
    return "running";
  if (props.loadingPluginPath === plugin.path) return "loading";
  if (props.loadError?.path === plugin.path) return "error";
  if (!vstStore.isPluginUsable(plugin)) return "disabled";
  return "idle";
}

function onSelect(plugin: ScannedPlugin) {
  if (!vstStore.isPluginUsable(plugin)) return;
  emit("select", plugin.path);
}

function pluginTooltip(plugin: ScannedPlugin): string {
  if (!vstStore.isPluginUsable(plugin)) {
    if (!plugin.hasMidiInput) return t("vst.disabledNoMidi");
    if (plugin.audioOutputs === 0) return t("vst.disabledNoOutput");
  }
  return plugin.path;
}
</script>

<template>
  <section class="card bg-base-100 border border-base-300">
    <div class="card-body p-5 gap-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold flex items-center gap-2">
          {{ t("vst.library") }}
          <span v-if="usableCount > 0" class="badge badge-ghost badge-sm">
            {{ t("vst.pluginCount", { count: usableCount }) }}
          </span>
        </h2>
        <button
          class="btn btn-ghost btn-sm"
          :disabled="props.isScanning"
          :title="t('vst.rescan')"
          :aria-label="t('vst.rescan')"
          @click="emit('rescan')"
        >
          <Icon
            name="refresh"
            :size="16"
            :class="{ 'animate-spin': props.isScanning }"
            aria-hidden="true"
          />
          <span class="hidden sm:inline">{{ t("vst.rescan") }}</span>
        </button>
      </div>

      <!-- 扫描中 -->
      <div
        v-if="props.isScanning"
        class="flex items-center gap-2 py-4 text-sm text-base-content/70"
      >
        <span class="loading loading-spinner loading-sm"></span>
        <span>{{ t("vst.scanning") }}</span>
      </div>

      <!-- 扫描器本身失败——区别于"没有装插件" -->
      <div
        v-else-if="props.scanError"
        class="alert alert-error items-start gap-2 text-sm"
        role="alert"
      >
        <Icon name="alert-circle" :size="16" aria-hidden="true" />
        <div class="flex flex-col gap-1">
          <span>{{ t("vst.scanFailed") }}</span>
          <span class="break-all opacity-80">{{ props.scanError }}</span>
        </div>
      </div>

      <!-- 空态 -->
      <p
        v-else-if="props.plugins.length === 0"
        class="py-4 text-sm text-base-content/60"
      >
        {{ t("vst.noPlugins") }}
      </p>

      <!-- 两栏：列表 + 详情 -->
      <div v-else class="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <!-- ── 左列：搜索 + 可滚动列表 ── -->
        <div class="flex flex-col gap-2 min-w-0">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              class="input input-sm w-full ps-8"
              :placeholder="t('vst.searchPlugins')"
              :aria-label="t('vst.searchPlugins')"
            />
            <Icon
              name="search"
              :size="14"
              class="absolute start-2.5 top-1/2 -translate-y-1/2 text-base-content/50 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          <ul
            class="flex flex-col gap-1.5 overflow-y-auto max-h-72 lg:max-h-[26rem] pe-0.5"
          >
            <li v-for="plugin in filteredPlugins" :key="plugin.path">
              <button
                class="w-full text-left rounded-lg border px-3 py-2 duration-150"
                :class="[
                  props.selectedPluginPath === plugin.path && props.isRunning
                    ? 'border-success/60 ring-1 ring-success'
                    : props.selectedPluginPath === plugin.path
                      ? 'border-primary/60 ring-1 ring-primary'
                      : 'border-base-300 hover:border-primary/50',
                  !vstStore.isPluginUsable(plugin)
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer',
                ]"
                :disabled="
                  !vstStore.isPluginUsable(plugin) ||
                  props.loadingPluginPath === plugin.path
                "
                :title="pluginTooltip(plugin)"
                @click="onSelect(plugin)"
              >
                <div class="flex items-center gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium">
                      {{ plugin.name }}
                    </div>
                    <div class="truncate text-xs text-base-content/60 mt-0.5">
                      {{ plugin.vendor }}
                      <template v-if="plugin.version"
                        >· {{ plugin.version }}</template
                      >
                    </div>
                  </div>
                  <!-- 状态标记 -->
                  <span
                    v-if="itemState(plugin) === 'loading'"
                    class="loading loading-spinner loading-xs shrink-0"
                  ></span>
                  <StateDot
                    v-else-if="itemState(plugin) === 'running'"
                    status="success"
                    size="xs"
                  />
                  <Icon
                    v-else-if="itemState(plugin) === 'error'"
                    name="alert-circle"
                    :size="14"
                    class="shrink-0 text-error"
                    aria-hidden="true"
                  />
                  <Icon
                    v-else-if="itemState(plugin) === 'disabled'"
                    name="lock"
                    :size="14"
                    class="shrink-0 text-base-content/50"
                    aria-hidden="true"
                  />
                </div>
              </button>
            </li>
          </ul>
          <p
            v-if="filteredPlugins.length === 0"
            class="text-sm text-base-content/60 py-1"
          >
            {{ t("vst.noSearchResults") }}
          </p>
        </div>

        <!-- ── 右列：选中插件详情 ── -->
        <div
          class="min-w-0 rounded-lg bg-base-200/40 border border-base-300/60 p-4 flex flex-col gap-3"
        >
          <template v-if="detailPlugin">
            <div class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <h3 class="font-semibold truncate">
                  {{ detailPlugin.name }}
                </h3>
                <p class="text-xs text-base-content/60 mt-0.5">
                  {{ detailPlugin.vendor }}
                </p>
              </div>
              <button
                class="btn btn-primary btn-sm shrink-0"
                :disabled="
                  !vstStore.isPluginUsable(detailPlugin) ||
                  props.loadingPluginPath === detailPlugin.path
                "
                @click="emit('select', detailPlugin.path)"
              >
                <span
                  v-if="props.loadingPluginPath === detailPlugin.path"
                  class="loading loading-spinner loading-xs"
                ></span>
                <span>{{ t("vst.loadPlugin") }}</span>
              </button>
            </div>

            <!-- 详情区加载失败 -->
            <div
              v-if="detailLoadError"
              class="alert alert-error items-start gap-2 text-xs"
              role="alert"
            >
              <Icon name="alert-circle" :size="14" aria-hidden="true" />
              <span class="min-w-0 flex-1 break-all">
                {{ detailLoadError.message }}
              </span>
            </div>

            <div class="flex flex-wrap gap-1">
              <span
                v-if="detailPlugin.category"
                class="badge badge-ghost badge-xs"
              >
                {{ detailPlugin.category }}
              </span>
              <span class="badge badge-ghost badge-xs">
                {{
                  t("vst.badgeAudioOuts", { count: detailPlugin.audioOutputs })
                }}
              </span>
              <span
                v-if="detailPlugin.hasGui"
                class="badge badge-ghost badge-xs"
              >
                GUI
              </span>
            </div>

            <dl
              class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs"
            >
              <dt class="text-base-content/50">
                {{ t("vst.detailVersion") }}
              </dt>
              <dd class="truncate">
                {{ detailPlugin.version || "—" }}
              </dd>
              <dt class="text-base-content/50">{{ t("vst.detailUid") }}</dt>
              <dd class="truncate font-mono" :title="detailPlugin.uid">
                {{ detailPlugin.uid || "—" }}
              </dd>
              <dt class="text-base-content/50">
                {{ t("vst.detailAudioIns") }}
              </dt>
              <dd class="tabular">{{ detailPlugin.audioInputs }}</dd>
              <dt class="text-base-content/50">{{ t("vst.detailMidiIn") }}</dt>
              <dd>{{ detailPlugin.hasMidiInput ? "✓" : "✗" }}</dd>
              <dt class="text-base-content/50">{{ t("vst.detailMidiOut") }}</dt>
              <dd>{{ detailPlugin.hasMidiOutput ? "✓" : "✗" }}</dd>
              <dt class="text-base-content/50">{{ t("vst.detailPath") }}</dt>
              <dd
                class="break-all font-mono text-[11px] text-base-content/60"
                :title="detailPlugin.path"
              >
                {{ detailPlugin.path }}
              </dd>
            </dl>
          </template>

          <!-- 未选中任何插件 -->
          <p v-else class="text-sm text-base-content/60">
            {{ t("vst.noPluginPicked") }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
