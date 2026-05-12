import { MidiInputDevice } from "./input_device.js";
import { MidiOutputDevice } from "./output_device.js";
import { InternalOutput } from "./internal_output.js";
export type MidiOutput = MidiOutputDevice | InternalOutput;
export interface MidiRouteRaw {
  input: string;
  output: string;
  type: "physical" | "internal";
  enabled: boolean;
}
export interface ApiMidiRoute {
  input: string;
  output: string;
  type: "physical" | "internal";
  enabled: boolean;
}
export interface ApiMidiWire {
  route: ApiMidiRoute;
  connected: boolean;
}
export declare class MidiRoute {
  input: string;
  output: string;
  type: "physical" | "internal";
  enabled: boolean;
  constructor(raw: MidiRouteRaw);
  isSame(route: MidiRoute): boolean;
  static fromApi(json: MidiRouteRaw): MidiRoute;
  toApi(): ApiMidiRoute;
}
export declare class MidiWire {
  route: MidiRoute;
  connected: boolean;
  input: MidiInputDevice | null;
  output: MidiOutput | null;
  constructor(route: MidiRoute);
  plug(input: MidiInputDevice, output: MidiOutput): void;
  unplug(): void;
  send(message: number[], timestamp: number, device: string): void;
  receive(_message: number[], _timestamp: number, _device: string): void;
  toApi(): ApiMidiWire;
}
//# sourceMappingURL=route.d.ts.map
