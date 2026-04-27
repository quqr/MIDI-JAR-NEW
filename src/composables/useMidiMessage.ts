import { onMounted, onUnmounted } from "vue";
import { useMidiMessagesStore } from "@/stores/midiMessages";

/**
 * Listens to a single MIDI message event.
 * Uses the midiMessages store instead of window.midiMessageManager.
 */
export function useMidiMessage(
  onMessage?: (message: number[], timestamp: number, device: string) => void,
  namespace: string = "debugger",
) {
  const handler = (message: number[], timestamp: number, device: string) => {
    onMessage?.(message, timestamp, device);
  };

  onMounted(() => {
    if (!onMessage) return;
    const store = useMidiMessagesStore();
    store.subscribeToNamespace(namespace, handler);
  });

  onUnmounted(() => {
    const store = useMidiMessagesStore();
    store.unsubscribeFromNamespace(namespace, handler);
  });
}

export default useMidiMessage;
