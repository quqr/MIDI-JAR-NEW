import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import i18n from "@/locales/i18n";
import "@/styles/tailwind.css";
import { useMidiRoutingStore } from "@/stores/midiRouting";
import { logger } from "@/utils/logger";
import { isElectron, getElectronAPI } from "@/utils/electron";

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

async function setupElectronListeners() {
  if (!isElectron()) {
    return;
  }

  try {
    const electronAPI = getElectronAPI();

    electronAPI.on("file:opened", (data: any) => {
      logger.info(`文件已打开: ${JSON.stringify(data)}`);
      app.config.globalProperties.$emit("file:opened", data);
    });

    electronAPI.on("midi:refresh-devices", () => {
      logger.info("收到 MIDI 设备刷新请求");
      initializeMidi();
    });

    electronAPI.on("midi:settings", (data: any) => {
      logger.info(`收到 MIDI 设置更新: ${JSON.stringify(data)}`);
      app.config.globalProperties.$emit("midi:settings", data);
    });

    logger.info("Electron 事件监听器已设置");
  } catch (error) {
    logger.error(`Electron 监听器设置失败: ${error}`);
  }
}

if (isElectron()) {
  logger.info("检测到 Electron 环境");
}

initializeMidi();
setupElectronListeners();

app.mount("#app");
