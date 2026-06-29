import { defineStore } from "pinia";
import { ref } from "vue";
import {
  InternalMidiMessages,
  MidiMessageEvent,
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

  const managerMap = new Map<string, InternalMidiMessages>();
  const refCountMap = new Map<string, number>();

  const listenerMap = new Map<
    (message: number[], timestamp: number, device: string) => void,
    (ev: MidiMessageEvent) => void
  >();

  function addMessage(
    message: number[],
    timestamp: number,
    device: string,
    namespace: string,
  ): void {
    const entry: MidiMessageEntry = { message, timestamp, device, namespace };
    messages.value.push(entry);
    if (messages.value.length > maxMessages) {
      messages.value.splice(0, messages.value.length - maxMessages);
    }
  }

  function cleanupManager(namespace: string): void {
    const manager = managerMap.get(namespace);
    if (manager) {
      manager.dispose();
      managerMap.delete(namespace);
    }
    refCountMap.delete(namespace);
  }

  async function getManager(namespace: string): Promise<InternalMidiMessages> {
    let manager = managerMap.get(namespace);

    if (manager && manager.isDisposed()) {
      managerMap.delete(namespace);
      refCountMap.delete(namespace);
      manager = null;
    }

    if (!manager) {
      manager = new InternalMidiMessages(namespace);
      managerMap.set(namespace, manager);
      refCountMap.set(namespace, 0);
      await manager.initialize();
    }

    return manager;
  }

  async function subscribeToNamespace(
    namespace: string,
    onMessage: (message: number[], timestamp: number, device: string) => void,
  ): Promise<void> {
    const listener = (ev: MidiMessageEvent) => {
      addMessage(ev.message, ev.timestamp, ev.device, namespace);
      onMessage(ev.message, ev.timestamp, ev.device);
    };

    listenerMap.set(onMessage, listener);
    const manager = await getManager(namespace);
    manager.addEventListener("message", listener);

    const currentCount = refCountMap.get(namespace) || 0;
    refCountMap.set(namespace, currentCount + 1);
  }

  function unsubscribeFromNamespace(
    namespace: string,
    onMessage: (message: number[], timestamp: number, device: string) => void,
  ): void {
    const listener = listenerMap.get(onMessage);
    if (listener) {
      const manager = managerMap.get(namespace);
      if (manager) {
        manager.removeEventListener("message", listener);

        const currentCount = refCountMap.get(namespace) || 0;
        if (currentCount <= 1) {
          cleanupManager(namespace);
        } else {
          refCountMap.set(namespace, currentCount - 1);
        }
      }
      listenerMap.delete(onMessage);
    }
  }

  function clearMessages(): void {
    messages.value = [];
  }

  function $reset(): void {
    for (const manager of managerMap.values()) {
      manager.dispose();
    }
    managerMap.clear();
    listenerMap.clear();
    refCountMap.clear();
    messages.value = [];
  }

  return {
    messages,
    addMessage,
    subscribeToNamespace,
    unsubscribeFromNamespace,
    clearMessages,
    $reset,
  };
});
