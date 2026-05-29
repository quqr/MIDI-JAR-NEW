import { app, ipcMain, IpcMainInvokeEvent } from "electron";

const ALLOWED_CHANNELS = new Set([
  "app:quit",
  "app:get-version",
  "app:get-platform",
  "window:minimize",
  "window:maximize",
  "window:close",
  "window:is-maximized",
  "window:get-state",
  "window:set-always-on-top",
  "window:start-drag",
  "window:on-maximized-changed",
  "window:set-ignore-mouse-events",
  "file:open-dialog",
  "file:save-dialog",
  "file:read",
  "file:write",
  "midi:refreshDevices",
  "midi:clearRoutes",
  "midi:addRoute",
  "midi:deleteRoute",
  "midi:getInputs",
  "midi:getOutputs",
  "midi:getWires",
  "shell:open-external",
]);

const isDev = !app.isPackaged;

export function validateChannel(channel: string): boolean {
  return ALLOWED_CHANNELS.has(channel);
}

export function secureHandle(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => any,
): void {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  }
  ipcMain.handle(channel, async (event, ...args) => {
    if (isDev) console.log(`[IPC] handle: ${channel}`);
    return handler(event, ...args);
  });
}

export function secureOn(
  channel: string,
  handler: (event: any, ...args: any[]) => void,
): void {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  }
  ipcMain.on(channel, (event, ...args) => {
    const senderUrl = event.senderFrame?.url;
    if (
      senderUrl &&
      senderUrl !== "about:blank" &&
      !senderUrl.startsWith("file://") &&
      !senderUrl.startsWith("http://localhost")
    ) {
      if (isDev)
        console.warn(
          `[IPC] Rejected message on "${channel}" from unauthorized origin: ${senderUrl}`,
        );
      return;
    }
    if (isDev) console.log(`[IPC] on: ${channel}`);
    handler(event, ...args);
  });
}
