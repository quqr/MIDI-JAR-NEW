import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { isTauri } from "@/utils/tauri";
import { createLogger } from "@/utils/logger";
import { loadFromStorage, saveToStorage, removeFromStorage } from "@/helpers";

const logger = createLogger("MidiRoutingStore");
import type { UnlistenFn } from "@tauri-apps/api/event";

export interface MidiRoute {
  input: string;
  output: string;
  type: "physical" | "internal";
  enabled: boolean;
}

export interface MidiInput {
  name: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}

export interface MidiOutput {
  name: string;
  type: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}

export interface MidiWire {
  route: MidiRoute;
  connected: boolean;
}

const STORAGE_KEY = "midi-jar-routes";
const NODE_POSITIONS_KEY = "midi-jar-node-positions";
const VIEWPORT_KEY = "midi-jar-viewport";

function loadRoutes(): MidiRoute[] {
  return loadFromStorage<MidiRoute[]>({
    key: STORAGE_KEY,
    defaultValue: [],
  });
}

function saveRoutes(routes: MidiRoute[]) {
  saveToStorage(STORAGE_KEY, routes);
}

function loadNodePositions(): Record<string, { x: number; y: number }> {
  return loadFromStorage<Record<string, { x: number; y: number }>>({
    key: NODE_POSITIONS_KEY,
    defaultValue: {},
  });
}

function saveNodePositions(
  positions: Record<string, { x: number; y: number }>,
) {
  saveToStorage(NODE_POSITIONS_KEY, positions);
}

interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

function loadViewport(): FlowViewport | null {
  return loadFromStorage<FlowViewport | null>({
    key: VIEWPORT_KEY,
    defaultValue: null,
  });
}

function saveViewport(viewport: FlowViewport) {
  saveToStorage(VIEWPORT_KEY, viewport);
}

export const useMidiRoutingStore = defineStore("midiRouting", () => {
  const initialized = ref(false);
  const inputs = ref<MidiInput[]>([]);
  const outputs = ref<MidiOutput[]>([]);
  const wires = ref<MidiWire[]>([]);
  const routes = ref<MidiRoute[]>(loadRoutes());
  const nodePositions =
    ref<Record<string, { x: number; y: number }>>(loadNodePositions());
  const viewport = ref<FlowViewport | null>(loadViewport());
  const error = ref<string | null>(null);

  let offInputs: UnlistenFn | null = null;
  let offOutputs: UnlistenFn | null = null;
  let offWires: UnlistenFn | null = null;
  let pollingTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 当不存在任何路由时，创建一条默认的 internal 路由，
   * 将第一个可用的输入设备连接到 internal 输出
   */
  function createDefaultRoutes(): void {
    if (routes.value.length > 0) return;
    if (inputs.value.length === 0) return;

    const firstInput = inputs.value[0].name;
    routes.value.push({
      input: firstInput,
      output: "internal",
      type: "internal",
      enabled: true,
    });
    saveRoutes(routes.value);
    logger.info(`已创建默认路由: ${firstInput} → internal`);
  }

  function syncRoutesToMain() {
    if (!isTauri()) {
      logger.info("syncRoutesToMain: not in Tauri, skipping");
      return Promise.resolve();
    }
    const routeList = routes.value.map((r) => ({
      input: r.input,
      output: r.output,
      type: r.type,
      enabled: r.enabled,
    }));
    logger.info(
      `syncRoutesToMain: syncing ${routeList.length} routes: ${JSON.stringify(routeList)}`,
    );
    return window.tauriAPI.midi.syncRoutes(routeList).catch((e: Error) => {
      logger.error(`同步路由失败: ${e.message}`);
    });
  }

  async function initialize(): Promise<void> {
    if (initialized.value) return;

    try {
      if (isTauri()) {
        const [inputsUnlisten, outputsUnlisten, wiresUnlisten] =
          await Promise.all([
            window.tauriAPI.midi.onInputs((data: MidiInput[]) => {
              inputs.value = data;
            }),
            window.tauriAPI.midi.onOutputs((data: MidiOutput[]) => {
              outputs.value = data;
            }),
            window.tauriAPI.midi.onWires((data: MidiWire[]) => {
              wires.value = data;
            }),
          ]);

        offInputs = inputsUnlisten;
        offOutputs = outputsUnlisten;
        offWires = wiresUnlisten;

        const [inputsData, outputsData, wiresData] = await Promise.all([
          window.tauriAPI.midi.getInputs(),
          window.tauriAPI.midi.getOutputs(),
          window.tauriAPI.midi.getWires(),
        ]);

        inputs.value = inputsData;
        outputs.value = outputsData;
        wires.value = wiresData;
      }

      createDefaultRoutes();

      await syncRoutesToMain();

      initialized.value = true;
      logger.info(
        `MIDI 路由初始化完成: ${inputs.value.length} 输入, ${outputs.value.length} 输出, ${wires.value.length} 连线`,
      );
    } catch (e: any) {
      error.value = e.message;
      logger.error(`MIDI 初始化失败: ${e.message}`);
    }
  }

  async function refreshDevices(): Promise<void> {
    if (isTauri()) {
      await window.tauriAPI.midi.refreshDevices();
      const [inputsData, outputsData, wiresData] = await Promise.all([
        window.tauriAPI.midi.getInputs(),
        window.tauriAPI.midi.getOutputs(),
        window.tauriAPI.midi.getWires(),
      ]);
      inputs.value = inputsData;
      outputs.value = outputsData;
      wires.value = wiresData;
    }
  }

  /**
   * 启动定时轮询以周期性刷新 MIDI 设备列表
   * @param intervalMs - 轮询间隔（毫秒），默认 3000ms
   */
  function startPolling(intervalMs: number = 3000): void {
    if (pollingTimer) return;
    pollingTimer = setInterval(() => {
      refreshDevices();
    }, intervalMs);
    logger.info(`MIDI 轮询已启动 (间隔 ${intervalMs}ms)`);
  }

  function stopPolling(): void {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
      logger.info("MIDI 轮询已停止");
    }
  }

  async function addRoute(route: MidiRoute): Promise<void> {
    const exists = routes.value.some(
      (r) =>
        r.input === route.input &&
        r.output === route.output &&
        r.type === route.type,
    );
    if (!exists) {
      routes.value = [
        ...routes.value,
        { ...route, enabled: route.enabled ?? true },
      ];
      saveRoutes(routes.value);
      await syncRoutesToMain();
      logger.info(
        `路由已创建: ${route.input} → ${route.output} (${route.type})`,
      );
    }
  }

  async function deleteRoute(route: MidiRoute): Promise<void> {
    routes.value = routes.value.filter(
      (r) =>
        !(
          r.input === route.input &&
          r.output === route.output &&
          r.type === route.type
        ),
    );
    saveRoutes(routes.value);
    await syncRoutesToMain();
    logger.warn(`路由已删除: ${route.input} → ${route.output} (${route.type})`);
  }

  /**
   * 将旧路由替换为新路由
   * @param oldRoute - 需要被替换的旧路由
   * @param newRoute - 替换后的新路由
   */
  async function updateRoute(
    oldRoute: MidiRoute,
    newRoute: MidiRoute,
  ): Promise<void> {
    routes.value = routes.value.map((r) =>
      r.input === oldRoute.input &&
      r.output === oldRoute.output &&
      r.type === oldRoute.type
        ? newRoute
        : r,
    );
    saveRoutes(routes.value);
    await syncRoutesToMain();
  }

  async function clearRoutes(): Promise<void> {
    routes.value = [];
    saveRoutes([]);
    if (isTauri()) {
      window.tauriAPI.midi.clearRoutes();
    }
  }

  function setNodePosition(nodeId: string, position: { x: number; y: number }) {
    nodePositions.value = {
      ...nodePositions.value,
      [nodeId]: position,
    };
    saveNodePositions(nodePositions.value);
  }

  function clearNodePositions() {
    nodePositions.value = {};
    saveNodePositions({});
  }

  function setViewport(vp: FlowViewport) {
    viewport.value = vp;
    saveViewport(vp);
  }

  function clearViewport() {
    viewport.value = null;
    removeFromStorage(VIEWPORT_KEY);
  }

  const physicalOutputs = computed(() =>
    outputs.value.filter((o) => o.type === "physical"),
  );
  const internalOutputs = computed(() =>
    outputs.value.filter((o) => o.type === "internal"),
  );

  // Virtual port methods
  async function isVirtualPortSupported(): Promise<boolean> {
    if (!isTauri()) return false;
    return await window.tauriAPI.midi.isVirtualPortSupported();
  }

  async function createVirtualInput(name: string): Promise<void> {
    if (!isTauri()) return;
    await window.tauriAPI.midi.createVirtualInput(name);
    logger.info(`虚拟输入端口已创建: ${name}`);
  }

  async function createVirtualOutput(name: string): Promise<void> {
    if (!isTauri()) return;
    await window.tauriAPI.midi.createVirtualOutput(name);
    logger.info(`虚拟输出端口已创建: ${name}`);
  }

  async function deleteVirtualInput(name: string): Promise<void> {
    if (!isTauri()) return;
    await window.tauriAPI.midi.deleteVirtualInput(name);
    logger.warn(`虚拟输入端口已删除: ${name}`);
  }

  async function deleteVirtualOutput(name: string): Promise<void> {
    if (!isTauri()) return;
    await window.tauriAPI.midi.deleteVirtualOutput(name);
    logger.warn(`虚拟输出端口已删除: ${name}`);
  }

  /**
   * 清理 store 资源：停止轮询并注销所有 Tauri 事件监听器
   */
  function cleanup() {
    stopPolling();
    if (offInputs) {
      offInputs();
      offInputs = null;
    }
    if (offOutputs) {
      offOutputs();
      offOutputs = null;
    }
    if (offWires) {
      offWires();
      offWires = null;
    }
  }

  return {
    initialized,
    inputs,
    outputs,
    wires,
    routes,
    nodePositions,
    viewport,
    error,
    initialize,
    refreshDevices,
    startPolling,
    stopPolling,
    createDefaultRoutes,
    syncRoutesToMain,
    addRoute,
    deleteRoute,
    updateRoute,
    clearRoutes,
    setNodePosition,
    clearNodePositions,
    setViewport,
    clearViewport,
    physicalOutputs,
    internalOutputs,
    isVirtualPortSupported,
    createVirtualInput,
    createVirtualOutput,
    deleteVirtualInput,
    deleteVirtualOutput,
    cleanup,
  };
});
