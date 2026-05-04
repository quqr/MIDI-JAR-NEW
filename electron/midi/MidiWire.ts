import { MidiInputDevice } from "./MidiInputDevice";
import { MidiOutputDevice } from "./MidiOutputDevice";
import { InternalOutput } from "./InternalOutput";
import { MidiRoute } from "./MidiRoute";

export type MidiOutput = MidiOutputDevice | InternalOutput;

export interface ApiMidiWire {
  route: MidiRoute["toApi"] extends () => infer R
    ? { route: R; connected: boolean }
    : never;
}

export class MidiWire {
  route: MidiRoute;
  connected = false;
  input: MidiInputDevice | null = null;
  output: MidiOutput | null = null;

  constructor(route: MidiRoute) {
    this.route = route;
    this.send = this.send.bind(this);
  }

  plug(input: MidiInputDevice, output: MidiOutput) {
    this.input = input;
    this.output = output;

    if (this.input && this.output) {
      this.input.register(this.send);
      this.output.register(this.receive);
      this.connected = true;
    } else {
      this.connected = false;
    }
  }

  unplug() {
    if (this.input) {
      this.input.unregister(this.send);
    }
    if (this.output) {
      this.output.unregister(this.receive);
    }
    this.connected = false;
    this.input = null;
    this.output = null;
  }

  send(message: number[], timestamp: number, device: string) {
    if (this.output) {
      this.output.send(message, timestamp, device);
    }
  }

  receive(_message: number[], _timestamp: number, _device: string) {}

  toApi() {
    return { route: this.route.toApi(), connected: this.connected };
  }
}
