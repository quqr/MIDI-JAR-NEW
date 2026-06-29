import { InternalOutput } from "./internal_output.js";
const MODULE_OUTPUTS = [
  "chord-dictionary",
  "chord-display/default",
  "debugger",
];
export function getModuleOutputs() {
  return MODULE_OUTPUTS;
}
export function sortOutputsFn(a, b) {
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
//# sourceMappingURL=utils.js.map
