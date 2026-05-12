import * as readline from "node:readline";
import { MidiDeviceManager } from "./device_manager.js";
import { MidiRoute } from "./route.js";
import { writeMessage, writeError } from "./protocol.js";
const REFRESH_LOOP_TIMEOUT = 100;
const manager = new MidiDeviceManager();
let loopTimeout = null;
let storedRoutes = [];
function getMidiRoutes() {
  return storedRoutes.map((raw) => MidiRoute.fromApi(raw));
}
function setMidiRoutes(routes) {
  storedRoutes = routes.map((r) => r.toApi());
}
function applyRoutes() {
  const routes = getMidiRoutes();
  manager.routeMidi(routes);
}
function handleRefreshDevices() {
  const changed = manager.refresh();
  if (changed) {
    applyRoutes();
  }
}
function handleAddRoute(params) {
  const route = MidiRoute.fromApi(params);
  const routes = getMidiRoutes();
  const existing = routes.find((r) => r.isSame(route));
  if (!existing) {
    setMidiRoutes([...routes, route]);
  }
  applyRoutes();
}
function handleDeleteRoute(params) {
  const route = MidiRoute.fromApi(params);
  const routes = getMidiRoutes();
  setMidiRoutes(routes.filter((r) => !r.isSame(route)));
  applyRoutes();
}
function handleClearRoutes() {
  setMidiRoutes([]);
  applyRoutes();
}
function handleGetInputs() {
  const data = manager.getInputs().map((i) => i.toApi());
  writeMessage({
    type: "event",
    event: "midi:inputs",
    data,
  });
  return data;
}
function handleGetOutputs() {
  const data = manager.getOutputs().map((o) => o.toApi());
  writeMessage({
    type: "event",
    event: "midi:outputs",
    data,
  });
  return data;
}
function handleGetWires() {
  const data = manager.getWires().map((w) => w.toApi());
  writeMessage({
    type: "event",
    event: "midi:wires",
    data,
  });
  return data;
}
function dispatchCommand(cmd) {
  const { id, method, params } = cmd;
  try {
    let data;
    switch (method) {
      case "refreshDevices":
        handleRefreshDevices();
        data = { ok: true };
        break;
      case "addRoute":
        handleAddRoute(params);
        data = { ok: true };
        break;
      case "deleteRoute":
        handleDeleteRoute(params);
        data = { ok: true };
        break;
      case "clearRoutes":
        handleClearRoutes();
        data = { ok: true };
        break;
      case "getInputs":
        data = handleGetInputs();
        break;
      case "getOutputs":
        data = handleGetOutputs();
        break;
      case "getWires":
        data = handleGetWires();
        break;
      default:
        writeError(`Unknown method: ${method}`);
        data = { error: `Unknown method: ${method}` };
        break;
    }
    writeMessage({ type: "result", id, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeError(`Error handling command ${method}: ${message}`);
    writeMessage({ type: "result", id, data: { error: message } });
  }
}
manager.on("midi", (device, message, timestamp, source) => {
  writeMessage({
    type: "event",
    event: "midi:message",
    data: { device, message, timestamp, source },
  });
});
manager.on("activity", (latency, device) => {
  writeMessage({
    type: "event",
    event: "midi:activity",
    data: { latency, device },
  });
});
manager.on("refreshed", () => {
  writeMessage({
    type: "event",
    event: "midi:device-changed",
    data: { ok: true },
  });
});
function startRefreshLoop() {
  handleRefreshDevices();
  loopTimeout = setTimeout(startRefreshLoop, REFRESH_LOOP_TIMEOUT);
}
function stopRefreshLoop() {
  if (loopTimeout) {
    clearTimeout(loopTimeout);
    loopTimeout = null;
  }
}
const rl = readline.createInterface({
  input: process.stdin,
  output: undefined,
  terminal: false,
});
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    if (msg && msg.type === "cmd") {
      dispatchCommand(msg);
    } else {
      writeError(`Unexpected message type: ${JSON.stringify(msg.type)}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeError(`Failed to parse stdin JSON: ${message}`);
  }
});
rl.on("close", () => {
  stopRefreshLoop();
  for (const input of manager.getInputs()) {
    input.close();
  }
  for (const output of manager.getOutputs()) {
    if ("close" in output && typeof output.close === "function") {
      output.close();
    }
  }
  process.exit(0);
});
process.on("SIGINT", () => {
  rl.close();
});
process.on("SIGTERM", () => {
  rl.close();
});
process.on("uncaughtException", (err) => {
  writeError(`Uncaught exception: ${err.message}`);
  writeError(err.stack ?? "");
});
process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  writeError(`Unhandled rejection: ${message}`);
});
writeMessage({
  type: "event",
  event: "midi:device-changed",
  data: { status: "ready" },
});
startRefreshLoop();
//# sourceMappingURL=index.js.map
