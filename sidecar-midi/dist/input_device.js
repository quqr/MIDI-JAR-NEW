import { EventEmitter } from "events";
import midi from "@julusian/midi";
import { performance } from "perf_hooks";
export class MidiInputDevice extends EventEmitter {
  input;
  handlers;
  name;
  connected;
  error;
  port;
  constructor(name, connected) {
    super();
    this.name = name;
    this.connected = connected;
    this.error = false;
    this.port = null;
    this.input = new midi.Input();
    this.handlers = [];
    this.input.on("message", this.onMessage.bind(this));
    this.input.ignoreTypes(false, false, false);
  }
  open() {
    if (this.input.isPortOpen()) return;
    for (let port = 0; port < this.input.getPortCount(); port += 1) {
      if (this.input.getPortName(port) === this.name) {
        try {
          this.input.openPort(port);
          this.port = port;
          this.error = !this.input.isPortOpen();
        } catch {
          this.error = true;
        }
      }
    }
  }
  close() {
    if (this.input.isPortOpen()) this.input.closePort();
  }
  onMessage(_deltaTime, message) {
    const timestamp = performance.now();
    for (let i = 0; i < this.handlers.length; i += 1) {
      this.handlers[i](message, timestamp, this.name);
    }
    const latency = performance.now() - timestamp;
    this.emit("latency", latency);
  }
  register(handler) {
    if (handler) {
      this.handlers.push(handler);
    }
    if (this.handlers.length) {
      this.open();
    }
  }
  unregister(handler) {
    if (handler) {
      const i = this.handlers.indexOf(handler);
      if (i >= 0) {
        this.handlers.splice(i, 1);
      }
    }
    if (!this.handlers.length) {
      this.close();
    }
  }
  toApi() {
    return {
      name: this.name,
      opened: this.input.isPortOpen(),
      connected: this.connected,
      error: this.error,
    };
  }
}
//# sourceMappingURL=input_device.js.map
