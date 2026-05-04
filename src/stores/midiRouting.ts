import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { isElectron } from "@/utils/electron";
import { logger } from "@/utils/logger";

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
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    logger.warn("Failed to load MIDI routes from localStorage: " + e);
  }
  return [];
}

function saveRoutes(routes: MidiRoute[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch (e) {
    logger.warn("Failed to save MIDI routes to localStorage: " + e);
  }
}

function loadNodePositions(): Record<string, { x: number; y: number }> {
  try {
    const stored = localStorage.getItem(NODE_POSITIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    logger.warn("Failed to load node positions from localStorage: " + e);
  }
  return {};
}

function saveNodePositions(positions: Record<string, { x: number; y: number }>) {
  try {
    localStorage.setItem(NODE_POSITIONS_KEY, JSON.stringify(positions));
  } catch (e) {
    logger.warn("Failed to save node positions to localStorage: " + e);
  }
}

interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

function loadViewport(): FlowViewport | null {
  try {
    const stored = localStorage.getItem(VIEWPORT_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    logger.warn("Failed to load viewport from localStorage: " + e);
  }
  return null;
}

function saveViewport(viewport: FlowViewport) {
  try {
    localStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport));
  } catch (e) {
    logger.warn("Failed to save viewport to localStorage: " + e);
  }
}

export const useMidiRoutingStore = defineStore("midiRouting", () => {
  const initialized = ref(false);
  const inputs = ref<MidiInput[]>([]);
  const outputs = ref<MidiOutput[]>([]);
  const wires = ref<MidiWire[]>([]);
  const routes = ref<MidiRoute[]>(loadRoutes());
  const nodePositions = ref<Record<string, { x: number; y: number }>>(loadNodePositions());
  const viewport = ref<FlowViewport | null>(loadViewport());
  const error = ref<string | null>(null);

  let offInputs: (() => void) | null = null;
  let offOutputs: (() => void) | null = null;
  let offWires: (() => void) | null = null;

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
    syncRoutesToMain();
    logger.info(`已创建默认路由: ${firstInput} → internal`);
  }

  function syncRoutesToMain() {
    if (!isElectron()) return;
    window.electronAPI.midi.clearRoutes();
    for (const route of routes.value) {
      window.electronAPI.midi.addRoute({
        input: route.input,
        output: route.output,
        type: route.type,
        enabled: route.enabled,
      });
    }
  }

  async function initialize(): Promise<void> {
    if (initialized.value) return;

    try {
      if (isElectron()) {
        window.electronAPI.midi.getInputs();
        window.electronAPI.midi.getOutputs();
        window.electronAPI.midi.getWires();

        offInputs = window.electronAPI.midi.onInputs((data: MidiInput[]) => {
          inputs.value = data;
        });

        offOutputs = window.electronAPI.midi.onOutputs((data: MidiOutput[]) => {
          outputs.value = data;
        });

        offWires = window.electronAPI.midi.onWires((data: MidiWire[]) => {
          wires.value = data;
        });
      }

      createDefaultRoutes();

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
    if (isElectron()) {
      window.electronAPI.midi.refreshDevices();
      console.log(`${inputs.value} 输入, ${outputs.value} 输出, ${wires.value.length} 连线`);
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
      syncRoutesToMain();
      logger.success(
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
    syncRoutesToMain();
    logger.warn(`路由已删除: ${route.input} → ${route.output} (${route.type})`);
  }

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
    syncRoutesToMain();
  }

  async function clearRoutes(): Promise<void> {
    routes.value = [];
    saveRoutes([]);
    if (isElectron()) {
      window.electronAPI.midi.clearRoutes();
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
    localStorage.removeItem(VIEWPORT_KEY);
  }

  const physicalOutputs = computed(() =>
    outputs.value.filter((o) => o.type === "physical"),
  );
  const internalOutputs = computed(() =>
    outputs.value.filter((o) => o.type === "internal"),
  );

  function cleanup() {
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
    createDefaultRoutes,
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
    cleanup,
  };
});
