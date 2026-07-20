import { ref } from "vue";
import { isTauri } from "@/utils/tauri";

type SupportLevel = "full" | "partial" | "none";

function detectSupportLevel(): SupportLevel {
  const ua = navigator.userAgent;

  // Chrome / Edge (Chromium) — 完整支持
  if (/Edg\//.test(ua) || (/Chrome\//.test(ua) && !/Chromium|OPR|Brave/.test(ua))) {
    return "full";
  }

  // Chromium 系其他浏览器也当 full
  if (/Chrome\//.test(ua)) {
    return "full";
  }

  // Firefox — 部分支持（无原生 Web MIDI，需插件）
  if (/Firefox\//.test(ua)) {
    return "partial";
  }

  // Safari — 不支持
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    return "none";
  }

  return "none";
}

const isMidiSupported = ref(false);
const supportLevel = ref<SupportLevel>("none");
const showMidiWarning = ref(false);

let initialized = false;

function initBrowserSupport(): void {
  if (initialized) return;
  initialized = true;

  // Tauri 环境始终为完整支持
  if (isTauri()) {
    isMidiSupported.value = true;
    supportLevel.value = "full";
    showMidiWarning.value = false;
    return;
  }

  isMidiSupported.value = "requestMIDIAccess" in navigator;
  supportLevel.value = detectSupportLevel();

  // 非 Tauri 环境下，若不支持 Web MIDI 则显示警告
  showMidiWarning.value = !isMidiSupported.value;
}

export function useBrowserSupport() {
  initBrowserSupport();

  return {
    isMidiSupported,
    supportLevel,
    showMidiWarning,
  };
}
