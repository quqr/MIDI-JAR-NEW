import { ref } from "vue";
import * as Tone from "tone";
import { isTauri } from "@/utils/tauri";

const audioReady = ref(false);

let listenerAttached = false;

/**
 * 确保 AudioContext 已启动。
 *
 * - Tauri 环境下无自动播放策略限制，音频始终就绪
 * - 浏览器环境下，首次用户交互时调用 Tone.start() 解锁 AudioContext
 */
export function ensureAudioReady(): void {
  if (audioReady.value) return;

  // Tauri 环境下音频始终就绪
  if (isTauri()) {
    Tone.start().then(() => {
      audioReady.value = true;
    });
    return;
  }

  // 浏览器环境：如果 AudioContext 未挂起，直接标记就绪
  if (Tone.context.state !== "suspended") {
    audioReady.value = true;
    return;
  }

  // 一次性监听用户交互来启动 AudioContext
  if (!listenerAttached) {
    listenerAttached = true;

    const startAudio = async () => {
      try {
        await Tone.start();
        audioReady.value = true;
      } catch {
        // Tone.start() 可能失败，静默处理
      }
      // 移除监听器
      document.removeEventListener("click", startAudio);
      document.removeEventListener("keydown", startAudio);
      document.removeEventListener("touchstart", startAudio);
    };

    document.addEventListener("click", startAudio, { once: true });
    document.addEventListener("keydown", startAudio, { once: true });
    document.addEventListener("touchstart", startAudio, { once: true });
  }
}

export function useAudioContext() {
  return {
    audioReady,
    ensureAudioReady,
  };
}
