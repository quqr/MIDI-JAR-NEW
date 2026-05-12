import { EventEmitter } from "events";
export type MidiMessageHandler = (
  message: number[],
  timestamp: number,
  device: string,
) => void;
export interface ApiMidiOutput {
  name: string;
  type: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}
export declare interface InternalOutput {
  on(
    event: "message",
    listener: (message: number[], timestamp: number, device: string) => void,
  ): this;
}
export declare class InternalOutput extends EventEmitter {
  name: string;
  namespace: string[];
  handlers: MidiMessageHandler[];
  constructor(name: string);
  send(message: number[], timestamp: number, device: string): void;
  register(handler: MidiMessageHandler): void;
  unregister(handler: MidiMessageHandler): void;
  toApi(): ApiMidiOutput;
}
//# sourceMappingURL=internal_output.d.ts.map
