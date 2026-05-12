export class MidiRoute {
  input;
  output;
  type;
  enabled;
  constructor(raw) {
    this.input = raw.input;
    this.output = raw.output;
    this.type = raw.type;
    this.enabled = !!raw.enabled;
  }
  isSame(route) {
    return (
      route.type === this.type &&
      route.input === this.input &&
      route.output === this.output
    );
  }
  static fromApi(json) {
    return new MidiRoute(json);
  }
  toApi() {
    return {
      input: this.input,
      output: this.output,
      type: this.type,
      enabled: this.enabled,
    };
  }
}
export class MidiWire {
  route;
  connected = false;
  input = null;
  output = null;
  constructor(route) {
    this.route = route;
    this.send = this.send.bind(this);
  }
  plug(input, output) {
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
  send(message, timestamp, device) {
    if (this.output) {
      this.output.send(message, timestamp, device);
    }
  }
  receive(_message, _timestamp, _device) {}
  toApi() {
    return { route: this.route.toApi(), connected: this.connected };
  }
}
//# sourceMappingURL=route.js.map
