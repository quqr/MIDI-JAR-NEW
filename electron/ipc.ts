export const IPC_CHANNELS = {
  APP: {
    QUIT: "app:quit",
    GET_VERSION: "app:get-version",
    GET_PLATFORM: "app:get-platform",
    ON_READY: "app:on-ready",
    ON_BEFORE_QUIT: "app:on-before-quit",
  },
  WINDOW: {
    MINIMIZE: "window:minimize",
    MAXIMIZE: "window:maximize",
    CLOSE: "window:close",
    IS_MAXIMIZED: "window:is-maximized",
    GET_STATE: "window:get-state",
    SET_ALWAYS_ON_TOP: "window:set-always-on-top",
    ON_STATE_CHANGED: "window:on-state-changed",
    ON_MAXIMIZED_CHANGED: "window:on-maximized-changed",
    START_DRAG: "window:start-drag",
    SET_IGNORE_MOUSE_EVENTS: "window:set-ignore-mouse-events",
  },
  FILE_SYSTEM: {
    OPEN_FILE_DIALOG: "file:open-dialog",
    READ_FILE: "file:read",
    WRITE_FILE: "file:write",
    SAVE_FILE_DIALOG: "file:save-dialog",
  },
  MIDI: {
    REFRESH_DEVICES: "midi:refreshDevices",
    CLEAR_ROUTES: "midi:clearRoutes",
    ADD_ROUTE: "midi:addRoute",
    DELETE_ROUTE: "midi:deleteRoute",
    GET_INPUTS: "midi:getInputs",
    ON_INPUTS: "midi:inputs",
    GET_OUTPUTS: "midi:getOutputs",
    ON_OUTPUTS: "midi:outputs",
    GET_WIRES: "midi:getWires",
    ON_WIRES: "midi:wires",
    ON_MIDI_MESSAGE: "midi:message",
    ON_ACTIVITY: "midi:activity",
  },
} as const;

export type IPCChannels = typeof IPC_CHANNELS;
