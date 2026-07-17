import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import i18n from "@/locales/i18n";
import "@/styles/tailwind.css";
import { useMidiRoutingStore } from "@/stores/midiRouting";
import { createLogger } from "@/utils/logger";
import { isTauri, getTauriAPI } from "@/utils/tauri";
import tauriAPI from "@/utils/tauri";
import { initRustLogListener } from "@/composables/useDebuggerLogs";

const logger = createLogger("Main");

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(router).use(i18n);

async function initializeMidi() {
  try {
    logger.info("应用初始化开始...");
    const routingStore = useMidiRoutingStore(pinia);
    await routingStore.initialize();
    logger.info("应用初始化完成");
  } catch (error) {
    logger.error({ err: error }, "MIDI 初始化失败");
  }
}

async function setupTauriListeners() {
  if (!isTauri()) {
    return;
  }

  // 确保 tauriAPI 已初始化
  if (!window.tauriAPI) {
    window.tauriAPI = tauriAPI;
  }

  // 禁用右键菜单和复制功能
  //document.addEventListener("contextmenu", (event) => event.preventDefault());
  //document.addEventListener("copy", (event) => event.preventDefault());

  try {
    const api = getTauriAPI();

    api.on("file:opened", (data: any) => {
      logger.info(`文件已打开: ${JSON.stringify(data)}`);
      app.config.globalProperties.$emit("file:opened", data);
    });

    api.on("midi:refresh-devices", () => {
      logger.info("收到 MIDI 设备刷新请求");
      initializeMidi();
    });

    api.on("midi:settings", (data: any) => {
      logger.info(`收到 MIDI 设置更新: ${JSON.stringify(data)}`);
      app.config.globalProperties.$emit("midi:settings", data);
    });

    logger.info("Tauri 事件监听器已设置");
  } catch (error) {
    logger.error(`Tauri 监听器设置失败: ${error}`);
  }
}

if (isTauri()) {
  logger.info("检测到 Tauri 环境");
  // 确保 tauriAPI 已初始化
  if (!window.tauriAPI) {
    window.tauriAPI = tauriAPI;
  }
}

// 全局注册 Rust 日志监听器（应用启动即开始收集）
// 浏览器环境自动跳过，Tauri 环境监听 "rust:log" 事件
initRustLogListener();

initializeMidi();
setupTauriListeners();

app.mount("#app");
