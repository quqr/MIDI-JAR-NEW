import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { MidiRoute, MidiInput, MidiOutput, MidiWire } from "@/types/midi";
import { MidiDeviceManager } from "@/midi/MidiDeviceManager";
import { logger } from "@/utils/logger";

const STORAGE_KEY = "midi-jar-routes";

function loadRoutes(): MidiRoute[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load MIDI routes from localStorage:", e);
  }
  return [];
}

function saveRoutes(routes: MidiRoute[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch (e) {
    console.warn("Failed to save MIDI routes to localStorage:", e);
  }
}

export const useMidiRoutingStore = defineStore("midiRouting", () => {
  const manager = new MidiDeviceManager();
  const initialized = ref(false);
  const inputs = ref<MidiInput[]>([]);
  const outputs = ref<MidiOutput[]>([]);
  const wires = ref<MidiWire[]>([]);
  const routes = ref<MidiRoute[]>(loadRoutes());
  const error = ref<string | null>(null);

  async function initialize(): Promise<void> {
    if (initialized.value) return;
    try {
      await manager.initialize();
      await refreshDevices();
      routeMidi();
      initialized.value = true;
    } catch (e: any) {
      error.value = e.message;
    }
  }

  async function refreshDevices(): Promise<void> {
    await manager.refreshDevices();
    inputs.value = manager.getInputs() as MidiInput[];
    outputs.value = manager.getOutputs() as MidiOutput[];
  }

  function routeMidi(): void {
    manager.routeMidi(routes.value);
    wires.value = manager.getWires() as MidiWire[];
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
      routeMidi();
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
    routeMidi();
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
    routeMidi();
  }

  async function clearRoutes(): Promise<void> {
    routes.value = [];
    saveRoutes([]);
    routeMidi();
  }

  function getOutputByName(name: string) {
    return manager.getOutputByName(name);
  }

  function addChordDisplayOutput(moduleId: string) {
    manager.addChordDisplayOutput(moduleId);
  }

  const physicalOutputs = computed(() =>
    outputs.value.filter((o) => o.type === "physical"),
  );
  const internalOutputs = computed(() =>
    outputs.value.filter((o) => o.type === "internal"),
  );

  return {
    initialized,
    inputs,
    outputs,
    wires,
    routes,
    error,
    initialize,
    refreshDevices,
    routeMidi,
    addRoute,
    deleteRoute,
    updateRoute,
    clearRoutes,
    getOutputByName,
    addChordDisplayOutput,
    physicalOutputs,
    internalOutputs,
  };
});
