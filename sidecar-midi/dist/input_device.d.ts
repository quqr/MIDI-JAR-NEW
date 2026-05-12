import { EventEmitter } from "events";
import { Input } from "@julusian/midi";
export type MidiMessageHandler = (
  message: number[],
  timestamp: number,
  device: string,
) => void;
export interface ApiMidiInput {
  name: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}
export declare interface MidiInputDevice {
  on(event: "latency", listener: (latency: number) => void): this;
}
export declare class MidiInputDevice extends EventEmitter {
  input: Input;
  handlers: MidiMessageHandler[];
  name: string;
  connected: boolean;
  error: boolean;
  port: number | null;
  constructor(name: string, connected: boolean);
  open(): void;
  close(): void;
  onMessage(_deltaTime: number, message: number[]): void;
  register(handler: MidiMessageHandler): void;
  unregister(handler: MidiMessageHandler): void;
  toApi(): ApiMidiInput;
}
//# sourceMappingURL=input_device.d.ts.map
