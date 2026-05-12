export interface SidecarCommand {
  type: "cmd";
  id: string;
  method:
    | "refreshDevices"
    | "addRoute"
    | "deleteRoute"
    | "clearRoutes"
    | "getInputs"
    | "getOutputs"
    | "getWires";
  params: Record<string, unknown>;
}
export interface SidecarResult {
  type: "result";
  id: string;
  data: unknown;
}
export interface SidecarEvent {
  type: "event";
  event:
    | "midi:message"
    | "midi:activity"
    | "midi:device-changed"
    | "midi:inputs"
    | "midi:outputs"
    | "midi:wires";
  data: unknown;
}
export type SidecarMessage = SidecarCommand | SidecarResult | SidecarEvent;
export declare function writeMessage(msg: SidecarMessage): void;
export declare function writeError(message: string): void;
//# sourceMappingURL=protocol.d.ts.map
