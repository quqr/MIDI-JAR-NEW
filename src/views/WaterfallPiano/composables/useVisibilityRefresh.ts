/**
 * 窗口可见性刷新 composable
 *
 * 统一处理窗口最小化/恢复后的 canvas 刷新问题。
 * 兼容浏览器和 Tauri 桌面环境。
 *
 * 策略：
 * - 使用 Web 标准 visibilitychange API（浏览器和 Tauri 都支持）
 * - Tauri 环境额外监听窗口焦点事件（更精准）
 * - 页面恢复可见时触发强制重绘
 */

import { onMounted, onUnmounted } from "vue";
import { createLogger } from "@/utils/logger";

const logger = createLogger("VisibilityRefresh");

export interface VisibilityRefreshTarget {
  /** 强制重绘方法：清空 canvas 并重新渲染当前帧 */
  forceRedraw: () => void;
}

/**
 * 注册窗口可见性变更监听器，页面恢复可见时触发目标对象的强制重绘
 * @param target - 包含 forceRedraw 方法的对象（如 WaterfallEngine）
 * @returns 清理函数
 */
export function useVisibilityRefresh(target: VisibilityRefreshTarget) {
  let tauriUnlisten: (() => void) | null = null;

  function onVisibilityChange(): void {
    if (!document.hidden) {
      logger.debug("Page became visible, forcing redraw");
      target.forceRedraw();
    }
  }

  async function setupTauriFocusListener(): Promise<void> {
    // 仅在 Tauri 环境中执行
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        const unlisten = await appWindow.onFocusChanged(
          ({ payload: focused }) => {
            if (focused && !document.hidden) {
              logger.debug("Tauri window focused, forcing redraw");
              target.forceRedraw();
            }
          },
        );
        tauriUnlisten = unlisten;
      } catch (e) {
        logger.warn({ err: e }, "Failed to setup Tauri focus listener");
      }
    }
  }

  onMounted(() => {
    document.addEventListener("visibilitychange", onVisibilityChange);
    setupTauriFocusListener();
  });

  onUnmounted(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    tauriUnlisten?.();
  });
}
