import { Output } from "@julusian/midi";
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
export declare class MidiOutputDevice {
  output: Output;
  name: string;
  connected: boolean;
  error: boolean;
  port: number | null;
  handlers: MidiMessageHandler[];
  constructor(name: string, connected: boolean);
  open(): void;
  close(): void;
  send(message: number[], timestamp: number, device: string): void;
  register(handler: MidiMessageHandler): void;
  unregister(handler: MidiMessageHandler): void;
  toApi(): ApiMidiOutput;
}
//# sourceMappingURL=output_device.d.ts.map
