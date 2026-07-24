// 流体对比测试页面核心组合逻辑
// 管理共享配置、收集两侧帧统计、生成对比日志、splat 事件广播

import { reactive, ref, readonly } from "vue";
import { DEFAULT_CONFIG } from "@/engine/fluid/FluidConfig";
import type { FluidSimulationConfig } from "@/engine/fluid/FluidConfig";
import type {
  FluidCompareLog,
  FluidFrameStats,
  FluidSide,
  RGB,
  SharedFluidConfig,
} from "../types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("FluidCompare");

/** 日志上限，超出后环形覆盖 */
const MAX_LOGS = 500;

/**
 * 流体对比测试核心组合
 *
 * 管理：
 * 1. sharedConfig — 两侧共享的响应式配置
 * 2. logs — 对比日志列表（环形缓冲）
 * 3. logging — 日志暂停/继续控制
 * 4. splat 广播 — 向两侧同时注入相同 splat
 */
export function useFluidCompare() {
  // ── 共享配置（两侧绑定同一对象）──
  const sharedConfig = reactive<SharedFluidConfig>({
    ...DEFAULT_CONFIG,
  }) as SharedFluidConfig;

  // ── 日志状态 ──
  const logs = ref<FluidCompareLog[]>([]);
  const logging = ref(true);

  // ── 帧统计暂存（等待两侧都到齐后合并）──
  const pendingStats = ref<{
    webgl?: FluidFrameStats;
    pixi?: FluidFrameStats;
    splatEvent?: FluidCompareLog["splatEvent"];
  }>({});

  // ── splat 广播回调注册 ──
  const splatHandlers = new Map<FluidSide, (x: number, y: number, dx: number, dy: number, color: RGB) => void>();

  /** 更新共享配置（由控制面板调用） */
  function updateConfig(patch: Partial<FluidSimulationConfig>): void {
    Object.assign(sharedConfig, patch);
    logger.debug({ patch }, "Config updated");
  }

  /** 注册 splat 广播处理器（由两侧面板调用） */
  function registerSplatHandler(
    side: FluidSide,
    handler: (x: number, y: number, dx: number, dy: number, color: RGB) => void,
  ): void {
    splatHandlers.set(side, handler);
  }

  /** 注销 splat 广播处理器 */
  function unregisterSplatHandler(side: FluidSide): void {
    splatHandlers.delete(side);
  }

  /**
   * 向两侧同时注入相同 splat（「同步喷射」按钮用）
   * 参数以用户输入空间为准（Y向上约定）
   */
  function broadcastSplat(
    x: number,
    y: number,
    dx: number,
    dy: number,
    color: RGB,
  ): void {
    // 记录 splat 事件
    const splatEvent = { x, y, dx, dy, color, side: "both" as const };
    pendingStats.value.splatEvent = splatEvent;

    // 广播到两侧
    splatHandlers.forEach((handler) => handler(x, y, dx, dy, color));
    logger.debug({ x, y, dx, dy, color }, "Splat broadcast");
  }

  /**
   * 记录单侧帧统计（由两侧面板每帧调用）
   * 两侧都到齐后合并成一条对比日志
   */
  function recordFrameStats(side: FluidSide, stats: FluidFrameStats): void {
    if (!logging.value) return;

    pendingStats.value[side] = stats;

    // 两侧都到齐，合并成一条日志
            if (pendingStats.value.webgl && pendingStats.value.pixi) {
              const webgl = pendingStats.value.webgl;
              const pixi = pendingStats.value.pixi;
              const wDiag = webgl.diagnostics;
              const pDiag = pixi.diagnostics;
              const entry: FluidCompareLog = {
                timestamp: Date.now(),
                webgl,
                pixi,
                diff: {
                  fpsDelta: pixi.fps - webgl.fps,
                  dtDelta: pixi.dt - webgl.dt,
                  splatCountDelta: pixi.splatCount - webgl.splatCount,
                  solverTotalDelta:
                    wDiag && pDiag
                      ? pDiag.stepTimings.total - wDiag.stepTimings.total
                      : undefined,
                  dyeSampleDelta:
                    wDiag && pDiag
                      ? {
                          r: pDiag.dyeSample.r - wDiag.dyeSample.r,
                          g: pDiag.dyeSample.g - wDiag.dyeSample.g,
                          b: pDiag.dyeSample.b - wDiag.dyeSample.b,
                        }
                      : undefined,
                },
                splatEvent: pendingStats.value.splatEvent,
              };

      logs.value.push(entry);
      // 环形覆盖
      if (logs.value.length > MAX_LOGS) {
        logs.value.splice(0, logs.value.length - MAX_LOGS);
      }

      // 重置暂存
      pendingStats.value = { splatEvent: undefined };
    }
  }

  /** 记录单侧 splat 事件（手动交互时） */
  function recordSplat(
    side: FluidSide,
    params: { x: number; y: number; dx: number; dy: number; color: RGB },
  ): void {
    if (!logging.value) return;
    pendingStats.value.splatEvent = { ...params, side };
  }

  /** 暂停/继续日志记录 */
  function toggleLogging(): void {
    logging.value = !logging.value;
    if (!logging.value) {
      pendingStats.value = {};
    }
  }

  /** 清空日志 */
  function clearLogs(): void {
    logs.value = [];
    pendingStats.value = {};
  }

  /** 导出日志为 JSON 文件 */
  function exportLogs(): void {
    const blob = new Blob([JSON.stringify(logs.value, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fluid-compare-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logger.info({ count: logs.value.length }, "Logs exported");
  }

  return {
    // 状态
    sharedConfig,
    logs: readonly(logs),
    logging: readonly(logging),

    // 配置
    updateConfig,

    // 帧统计
    recordFrameStats,
    recordSplat,

    // Splat 广播
    registerSplatHandler,
    unregisterSplatHandler,
    broadcastSplat,

    // 日志控制
    toggleLogging,
    clearLogs,
    exportLogs,
  };
}
