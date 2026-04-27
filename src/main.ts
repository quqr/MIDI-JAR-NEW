import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import i18n from "@/locales/i18n";
import "@/styles/tailwind.css";
import { useMidiRoutingStore } from "@/stores/midiRouting";
import { MidiMessageManager } from "@/midi/MidiMessageManager";
import { InternalOutput } from "@/midi/InternalOutput";
import { logger } from "@/utils/logger";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(router).use(i18n);

async function initializeMidi() {
  try {
    logger.info("应用初始化开始...");
    const routingStore = useMidiRoutingStore(pinia);
    await routingStore.initialize();

    const messageManager = MidiMessageManager.getInstance();

    routingStore.outputs.forEach((output) => {
      if (output.type === "internal") {
        const internalOutput = new InternalOutput(output.name);
        messageManager.registerOutput(output.name, internalOutput);
      }
    });

    const savedRoutes = routingStore.routes;
    if (savedRoutes && savedRoutes.length > 0) {
      routingStore.routeMidi();
    }
    logger.success("应用初始化完成");
  } catch (error) {
    logger.error(`MIDI 初始化失败: ${error}`);
  }
}

initializeMidi();

app.mount("#app");
