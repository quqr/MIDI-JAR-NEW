/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

type MidiMessageTuple = [number, number, number];

interface MidiMessageEvent {
  message: MidiMessageTuple;
  timestamp: number;
  device: string;
}

interface Window {
  midi?: {
    onLatency: (
      callback: (latency: number, device: string) => void,
    ) => (() => void) | undefined;
  };
  midiMessageManager?: {
    addEventListener: (
      event: "message",
      listener: (event: MidiMessageEvent) => void,
    ) => void;
    removeEventListener: (
      event: "message",
      listener: (event: MidiMessageEvent) => void,
    ) => void;
  };
}
