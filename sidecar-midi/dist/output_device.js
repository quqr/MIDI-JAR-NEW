import midi from "@julusian/midi";
export class MidiOutputDevice {
  output;
  name;
  connected;
  error;
  port;
  handlers;
  constructor(name, connected) {
    this.name = name;
    this.port = null;
    this.connected = connected;
    this.error = false;
    this.output = new midi.Output();
    this.handlers = [];
  }
  open() {
    if (this.output.isPortOpen()) return;
    for (let port = 0; port < this.output.getPortCount(); port += 1) {
      if (this.output.getPortName(port) === this.name) {
        try {
          this.output.openPort(port);
          this.port = port;
          this.error = !this.output.isPortOpen();
        } catch {
          this.error = true;
        }
      }
    }
  }
  close() {
    if (this.output.isPortOpen()) this.output.closePort();
  }
  send(message, timestamp, device) {
    this.output.sendMessage(message);
    process.nextTick(() => {
      for (let i = 0; i < this.handlers.length; i += 1) {
        this.handlers[i](message, timestamp, this.name);
      }
    });
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
      type: "physical",
      opened: this.output.isPortOpen(),
      connected: this.connected,
      error: this.error,
    };
  }
}
//# sourceMappingURL=output_device.js.map
