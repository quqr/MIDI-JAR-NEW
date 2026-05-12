import { EventEmitter } from "events";
import midi from "@julusian/midi";
import { InternalOutput } from "./internal_output.js";
import { MidiInputDevice } from "./input_device.js";
import { MidiOutputDevice } from "./output_device.js";
import { MidiWire } from "./route.js";
import { getModuleOutputs, sortOutputsFn } from "./utils.js";
const IGNORE_RTMIDI_REGEX = /RtMidi/i;
const IGNORE_INPUT_REGEX = /^output-internal/i;
const midiIn = new midi.Input();
const midiOut = new midi.Output();
export class MidiDeviceManager extends EventEmitter {
  inputs;
  outputs;
  wires;
  constructor() {
    super();
    this.inputs = new Map();
    this.outputs = new Map();
    this.wires = [];
  }
  refresh() {
    let changed = false;
    changed = this.refreshInternalOutputs() || changed;
    changed = this.refreshInputs() || changed;
    changed = this.refreshOutputs() || changed;
    return changed;
  }
  refreshInternalOutputs() {
    let changed = false;
    const internalOutputs = getModuleOutputs();
    for (const name of internalOutputs) {
      if (!this.outputs.has(name)) {
        const newOutput = new InternalOutput(name);
        newOutput.addListener("message", (message, timestamp, device) =>
          this.emit("midi", newOutput.name, message, timestamp, device),
        );
        this.outputs.set(name, newOutput);
        changed = true;
      }
    }
    return changed;
  }
  refreshInputs() {
    let changed = false;
    const inputs = [];
    for (let port = 0; port < midiIn.getPortCount(); port += 1) {
      const name = midiIn.getPortName(port);
      if (!name.match(IGNORE_RTMIDI_REGEX) && !name.match(IGNORE_INPUT_REGEX)) {
        inputs.push(name);
        const input = this.inputs.get(name);
        if (!input) {
          const newInput = new MidiInputDevice(name, true);
          this.inputs.set(name, newInput);
          newInput.addListener("latency", (latency) =>
            this.emit("activity", latency, name),
          );
          changed = true;
        } else if (!input.connected) {
          input.connected = true;
          changed = true;
        }
      }
    }
    for (const input of this.inputs.values()) {
      if (inputs.indexOf(input.name) <= -1) {
        if (input.connected) {
          input.connected = false;
          input.close();
          changed = true;
        }
      }
    }
    return changed;
  }
  refreshOutputs() {
    let changed = false;
    const outputs = [];
    for (let port = 0; port < midiOut.getPortCount(); port += 1) {
      const name = midiOut.getPortName(port);
      if (!name.match(IGNORE_RTMIDI_REGEX)) {
        outputs.push(name);
        const output = this.outputs.get(name);
        if (!output || output instanceof InternalOutput) {
          this.outputs.set(
            name,
            new MidiOutputDevice(midiOut.getPortName(port), true),
          );
          changed = true;
        } else if (!output.connected) {
          output.connected = true;
          changed = true;
        }
      }
    }
    for (const output of this.outputs.values()) {
      if (
        outputs.indexOf(output.name) <= -1 &&
        output instanceof MidiOutputDevice
      ) {
        if (output.connected) {
          output.connected = false;
          output.close();
          changed = true;
        }
      }
    }
    return changed;
  }
  getOrCreateInput(name) {
    const input = this.inputs.get(name);
    if (!input) {
      const newInput = new MidiInputDevice(name, false);
      this.inputs.set(name, newInput);
      return newInput;
    }
    return input;
  }
  getOrCreateOutput(name, type) {
    const output = this.outputs.get(name);
    if (!output) {
      switch (type) {
        case "internal": {
          const newOutput = new InternalOutput(name);
          newOutput.addListener("message", (message, timestamp, device) =>
            this.emit("midi", newOutput.name, message, timestamp, device),
          );
          this.outputs.set(name, newOutput);
          return newOutput;
        }
        default: {
          const newOutput = new MidiOutputDevice(name, false);
          this.outputs.set(name, newOutput);
          return newOutput;
        }
      }
    }
    return output;
  }
  routeMidi(routes) {
    const previousWires = this.wires;
    this.wires = [];
    for (let r = 0; r < routes.length; r += 1) {
      const route = routes[r];
      if (route.enabled) {
        const input = this.getOrCreateInput(route.input);
        const output = this.getOrCreateOutput(route.output, route.type);
        const wire = new MidiWire(routes[r]);
        wire.plug(input, output);
        this.wires.push(wire);
      }
    }
    for (let w = 0; w < previousWires.length; w += 1) {
      previousWires[w].unplug();
    }
    this.emit("refreshed");
  }
  getInputs() {
    return Array.from(this.inputs.values());
  }
  getOutputs() {
    const outputs = Array.from(this.outputs.values());
    outputs.sort(sortOutputsFn);
    return outputs;
  }
  getWires() {
    return Array.from(this.wires);
  }
}
//# sourceMappingURL=device_manager.js.map
