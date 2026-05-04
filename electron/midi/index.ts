import midi from "@julusian/midi";
import { MidiRoute, MidiRouteRaw } from "./MidiRoute";
import { MidiDeviceManager } from "./MidiDeviceManager";
import { MidiWire } from "./MidiWire";

const IGNORE_RTMIDI_REGEX = /RtMidi/i;

const midiIn = new midi.Input();
const midiOut = new midi.Output();

export const manager = new MidiDeviceManager();

const REFRESH_LOOP_TIMEOUT = 100;

let loopTimeout: ReturnType<typeof setTimeout> | null = null;

let storedRoutes: MidiRouteRaw[] = [];

function getMidiRoutes(): MidiRoute[] {
  return storedRoutes.map((route) => MidiRoute.fromApi(route));
}

function setMidiRoutes(routes: MidiRoute[]) {
  storedRoutes = routes.map((route) => route.toApi());
}

function routeMidi() {
  const routes = getMidiRoutes();
  manager.routeMidi(routes);
}

export function addRoute(apiRoute: MidiRouteRaw) {
  const route = MidiRoute.fromApi(apiRoute);
  const routes = getMidiRoutes();
  const existingRoute = routes.find((r) => r.isSame(route));
  if (!existingRoute) {
    setMidiRoutes([...routes, route]);
  }
  routeMidi();
}

export function deleteRoute(apiRoute: MidiRouteRaw) {
  const route = MidiRoute.fromApi(apiRoute);
  const routes = getMidiRoutes();
  setMidiRoutes(routes.filter((r) => !r.isSame(route)));
  routeMidi();
}

export function clearRoutes() {
  setMidiRoutes([]);
  routeMidi();
}

export function refreshDevices(force = false) {
  const changed = manager.refresh();
  if (changed || force) {
    routeMidi();
  }
}

export function startRefreshLoop() {
  refreshDevices();
  loopTimeout = setTimeout(startRefreshLoop, REFRESH_LOOP_TIMEOUT);
}

export function stopRefreshLoop() {
  if (loopTimeout) clearTimeout(loopTimeout);
  loopTimeout = null;
}

export function getInputs() {
  return manager.getInputs().map((i) => i.toApi());
}

export function getOutputs() {
  return manager.getOutputs().map((o) => o.toApi());
}

export function getWires() {
  return manager.getWires().map((w) => w.toApi());
}

export { MidiRoute } from "./MidiRoute";
export type { MidiRouteRaw } from "./MidiRoute";
export { MidiDeviceManager } from "./MidiDeviceManager";
export { getModuleOutputs } from "./utils";
