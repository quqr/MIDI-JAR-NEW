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
