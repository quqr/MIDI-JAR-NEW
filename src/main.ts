import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import i18n from "@/locales/i18n";
import "@/styles/tailwind.css";
import { useMidiRoutingStore } from "@/stores/midiRouting";
import { logger } from "@/utils/logger";
import { isTauri, getTauriAPI } from "@/utils/tauri";

logger.interceptConsole();

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(router).use(i18n);

async function initializeMidi() {
  try {
    logger.info("应用初始化开始...");
    const routingStore = useMidiRoutingStore(pinia);
    await routingStore.initialize();
    logger.success("应用初始化完成");
  } catch (error) {
    logger.error(`MIDI 初始化失败: ${error}`);
  }
}

async function setupTauriListeners() {
  if (!isTauri()) {
    return;
  }

  // 监听 contextmenu 事件（即右键菜单），并阻止其默认行为，以禁用右键菜单
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  // 监听 copy 事件（即复制操作），并阻止其默认行为，以禁用复制功能
  document.addEventListener("copy", (event) => event.preventDefault());
  try {
    const tauriAPI = getTauriAPI();

    tauriAPI.on("file:opened", (data: any) => {
      logger.info(`文件已打开: ${JSON.stringify(data)}`);
      app.config.globalProperties.$emit("file:opened", data);
    });

    tauriAPI.on("midi:refresh-devices", () => {
      logger.info("收到 MIDI 设备刷新请求");
      initializeMidi();
    });

    tauriAPI.on("midi:settings", (data: any) => {
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
}

initializeMidi();
setupTauriListeners();

app.mount("#app");
