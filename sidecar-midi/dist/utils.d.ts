import { MidiOutputDevice } from "./output_device.js";
import { InternalOutput } from "./internal_output.js";
export type MidiOutput = MidiOutputDevice | InternalOutput;
export declare function getModuleOutputs(): string[];
export declare function sortOutputsFn(a: MidiOutput, b: MidiOutput): number;
//# sourceMappingURL=utils.d.ts.map
