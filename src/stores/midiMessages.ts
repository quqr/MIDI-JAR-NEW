import { defineStore } from "pinia";
import { ref } from "vue";
import {
  MidiMessageManager,
  MidiMessageListener,
} from "@/midi/MidiMessageManager";

export type MidiMessageEntry = {
  message: number[];
  timestamp: number;
  device: string;
  namespace: string;
};

export const useMidiMessagesStore = defineStore("midiMessages", () => {
  const messages = ref<MidiMessageEntry[]>([]);
  const maxMessages = 200;
  const manager = MidiMessageManager.getInstance();

  function addMessage(
    message: number[],
    timestamp: number,
    device: string,
    namespace: string,
  ): void {
    const entry: MidiMessageEntry = { message, timestamp, device, namespace };
    messages.value.unshift(entry);
    if (messages.value.length > maxMessages) {
      messages.value = messages.value.slice(0, maxMessages);
    }
  }

  function subscribeToNamespace(
    namespace: string,
    onMessage: (message: number[], timestamp: number, device: string) => void,
  ): void {
    const listener: MidiMessageListener = (message, timestamp, device) => {
      addMessage(message, timestamp, device, namespace);
      onMessage(message, timestamp, device);
    };
    manager.subscribe(namespace, listener);
  }

  function unsubscribeFromNamespace(
    namespace: string,
    listener: MidiMessageListener,
  ): void {
    manager.unsubscribe(namespace, listener);
  }

  function clearMessages(): void {
    messages.value = [];
  }

  return {
    messages,
    addMessage,
    subscribeToNamespace,
    unsubscribeFromNamespace,
    clearMessages,
  };
});
