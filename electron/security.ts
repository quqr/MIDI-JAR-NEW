import { ipcMain, IpcMainInvokeEvent } from "electron";

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
  "midi:get-inputs",
  "midi:get-outputs",
]);

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
    console.log(`[IPC] handle: ${channel}`);
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
    console.log(`[IPC] on: ${channel}`);
    handler(event, ...args);
  });
}
