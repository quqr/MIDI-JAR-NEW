import { EventEmitter } from "events";
import { InternalOutput } from "./internal_output.js";
import { MidiInputDevice } from "./input_device.js";
import { MidiOutputDevice } from "./output_device.js";
import { MidiRoute } from "./route.js";
import { MidiWire } from "./route.js";
export declare interface MidiDeviceManager {
  on(event: "refreshed", listener: () => void): this;
  on(
    event: "midi",
    listener: (
      device: string,
      message: number[],
      timestamp: number,
      source: string,
    ) => void,
  ): this;
  on(
    event: "activity",
    listener: (latency: number, device: string) => void,
  ): this;
}
export declare class MidiDeviceManager extends EventEmitter {
  inputs: Map<string, MidiInputDevice>;
  outputs: Map<string, MidiOutputDevice | InternalOutput>;
  wires: MidiWire[];
  constructor();
  refresh(): boolean;
  refreshInternalOutputs(): boolean;
  refreshInputs(): boolean;
  refreshOutputs(): boolean;
  getOrCreateInput(name: string): MidiInputDevice;
  getOrCreateOutput(
    name: string,
    type: MidiRoute["type"],
  ): MidiOutputDevice | InternalOutput;
  routeMidi(routes: MidiRoute[]): void;
  getInputs(): MidiInputDevice[];
  getOutputs(): (MidiOutputDevice | InternalOutput)[];
  getWires(): MidiWire[];
}
//# sourceMappingURL=device_manager.d.ts.map
