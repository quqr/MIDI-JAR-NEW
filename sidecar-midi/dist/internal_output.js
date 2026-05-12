import { EventEmitter } from "events";
export class InternalOutput extends EventEmitter {
  name;
  namespace;
  handlers;
  constructor(name) {
    super();
    this.name = name;
    this.namespace = name.split("/");
    this.handlers = [];
  }
  send(message, timestamp, device) {
    process.nextTick(() => {
      this.emit("message", message, timestamp, device);
      for (let i = 0; i < this.handlers.length; i += 1) {
        this.handlers[i](message, timestamp, device);
      }
    });
  }
  register(handler) {
    if (handler) {
      this.handlers.push(handler);
    }
  }
  unregister(handler) {
    if (handler) {
      const i = this.handlers.indexOf(handler);
      if (i >= 0) {
        this.handlers.splice(i, 1);
      }
    }
  }
  toApi() {
    return {
      name: this.name,
      type: "internal",
      opened: true,
      connected: true,
      error: false,
    };
  }
}
//# sourceMappingURL=internal_output.js.map
