import { MidiOutputDevice } from "./MidiOutputDevice";
import { InternalOutput } from "./InternalOutput";

export type MidiOutput = MidiOutputDevice | InternalOutput;

const MODULE_OUTPUTS = [
  "chord-dictionary",
  "chord-display/default",
  "debugger",
];

export function getModuleOutputs(): string[] {
  return MODULE_OUTPUTS;
}

export function sortOutputsFn(a: MidiOutput, b: MidiOutput) {
  if (a instanceof InternalOutput && b instanceof InternalOutput) {
    return a.name < b.name ? -1 : 1;
  }

  if (a instanceof InternalOutput) {
    return -1;
  }

  if (b instanceof InternalOutput) {
    return 1;
  }

  return a.name < b.name ? -1 : 1;
}
