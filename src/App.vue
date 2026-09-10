<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterView } from "vue-router";
import AppNavbar from "@/views/Layout/AppNavbar.vue";
import CustomCursor from "@/components/CustomCursor.vue";
import FpsOverlay from "@/components/common/FpsOverlay.vue";
import { useBrowserSupport } from "@/composables/useBrowserSupport";
import { useSamplerService } from "@/composables/useSamplerService";
import { useSamplerStore } from "@/stores/sampler";
import { useVstStore } from "@/stores/vst";
import { isTauri } from "@/utils/tauri";
import { createLogger } from "@/utils/logger";

const logger = createLogger("App");

const { showMidiWarning } = useBrowserSupport();
const inTauri = isTauri();
const midiWarningVisible = ref(true);

function dismissMidiWarning() {
  midiWarningVisible.value = false;
}

// ─── 音源引擎全局启动（VST 与页面无关：5+ 模块经由 useSamplerService 发声） ───
const samplerService = useSamplerService();
const samplerStore = useSamplerStore();
const vstStore = useVstStore();

// 安装音源切换副作用（幂等）：切到采样器时延迟 30s 卸载 VST（ADR 0021 / L2）
samplerService.installToneSourceWatcher();

onMounted(() => {
  if (inTauri) void bootstrapVst();
});

/**
 * 启动 VST 子系统（全局一次）。
 *
 * 顺序有讲究：先把自定义目录交给后端，扫描才能覆盖到它们；
 * 缓存先显示（秒开），再后台扫描刷新（结果不同才渲染差异）。
 * 若上次退出时用的是 VST，自动恢复插件——不依赖用户是否路过某个页面。
 * 整个流程非阻塞，失败只记日志——VST 是可选能力。
 */
async function bootstrapVst() {
  try {
    await vstStore.subscribeEvents();
    await vstStore.restoreScanPaths();
    await vstStore.loadCachedScan();
    // 同步一次宿主状态：应用重启后后端是空的，但 store 可能还记着上次的选择
    await vstStore.refreshStatus();
    void vstStore.scan();

    if (
      samplerStore.toneSource === "vst" &&
      vstStore.selectedPluginPath &&
      !vstStore.isRunning
    ) {
      void vstStore
        .selectPlugin(vstStore.selectedPluginPath, true)
        .catch(() => {
          // 加载失败 → store 已进入错误态，由导航栏红点与 VST 页就地呈现
        });
    }
  } catch (err) {
    logger.warn("[App] VST bootstrap failed: %s", err);
  }
}
</script>

<template>
  <CustomCursor />
  <FpsOverlay />
  <div
    v-if="!inTauri && showMidiWarning && midiWarningVisible"
    class="alert alert-warning m-2"
    role="alert"
  >
    <span
      >当前浏览器不支持 Web MIDI API，请使用 Chrome 或 Edge 以获得完整 MIDI
      体验</span
    >
    <button
      class="btn btn-ghost btn-xs"
      aria-label="关闭"
      @click="dismissMidiWarning"
    >
      ✕
    </button>
  </div>
  <div class="grid grid-rows-[auto_1fr_auto] h-screen w-screen bg-base-100">
    <AppNavbar />
    <RouterView />
  </div>
</template>
