<template>
  <div class="flex h-full overflow-hidden bg-base-100">
    <!-- 左侧控制面板 -->
    <aside class="w-72 shrink-0 overflow-auto p-2 border-r border-base-300">
      <FluidControlPanel
        :config="sharedConfig"
        @config-change="updateConfig"
        @sync-splat="onSyncSplat"
        @random-splat="onRandomSplat"
      />
    </aside>

    <!-- 右侧主区域 -->
    <main class="flex-1 flex flex-col overflow-hidden p-2 gap-2">
      <!-- 双侧对比画布 -->
      <div class="flex-1 flex gap-2 min-h-0">
        <div class="flex-1 min-w-0">
          <WebGLFluidPanel
            :config="sharedConfig"
            @frame-stats="(s) => recordFrameStats('webgl', s)"
            @ready="(fn) => registerSplatHandler('webgl', fn)"
          />
        </div>
        <div class="flex-1 min-w-0">
          <PixiFluidPanel
            :config="sharedConfig"
            @frame-stats="(s) => recordFrameStats('pixi', s)"
            @ready="(fn) => registerSplatHandler('pixi', fn)"
          />
        </div>
      </div>

      <!-- 底部日志面板 -->
      <FluidLogPanel
        :logs="logs"
        :logging="logging"
        @toggle-logging="toggleLogging"
        @clear-logs="clearLogs"
        @export-logs="exportLogs"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted } from "vue";
import FluidControlPanel from "./components/FluidControlPanel.vue";
import WebGLFluidPanel from "./components/WebGLFluidPanel.vue";
import PixiFluidPanel from "./components/PixiFluidPanel.vue";
import FluidLogPanel from "./components/FluidLogPanel.vue";
import { useFluidCompare } from "./composables/useFluidCompare";
import type { RGB } from "./types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("FluidComparePage");

const {
  sharedConfig,
  logs,
  logging,
  updateConfig,
  recordFrameStats,
  registerSplatHandler,
  unregisterSplatHandler,
  broadcastSplat,
  toggleLogging,
  clearLogs,
  exportLogs,
} = useFluidCompare();

/** HSV 转 RGB */
function hsvToRgb(h: number, s: number, v: number): RGB {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r, g, b };
}

/** 生成随机颜色（与原始项目一致：×0.15 压暗） */
function generateColor(): RGB {
  const c = hsvToRgb(Math.random(), 1.0, 1.0);
  return { r: c.r * 0.15, g: c.g * 0.15, b: c.b * 0.15 };
}

/** 同步喷射：两侧同时注入相同 splat */
function onSyncSplat(): void {
  const x = Math.random();
  const y = Math.random();
  const dx = (Math.random() - 0.5) * 1000;
  const dy = (Math.random() - 0.5) * 1000;
  const color = generateColor();
  broadcastSplat(x, y, dx, dy, color);
  logger.debug({ x, y, dx, dy, color }, "Sync splat");
}

/** 随机喷射：向两侧广播 5 个随机 splat */
function onRandomSplat(): void {
  for (let i = 0; i < 5; i++) {
    const x = Math.random();
    const y = Math.random();
    const dx = (Math.random() - 0.5) * 1000;
    const dy = (Math.random() - 0.5) * 1000;
    const color = generateColor();
    broadcastSplat(x, y, dx, dy, color);
  }
  logger.debug("Random splats (5)");
}

onUnmounted(() => {
  unregisterSplatHandler("webgl");
  unregisterSplatHandler("pixi");
});
</script>
