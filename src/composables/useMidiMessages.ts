import { onMounted, onUnmounted, ref } from "vue";
import { useMidiMessagesStore } from "@/stores/midiMessages";

export type MidiMessagesBuffer = Array<[number[], number, string]>;

export function useMidiMessages(
  onMessages: (messages: MidiMessagesBuffer) => void,
  namespace: string = "debugger",
) {
  const buffer = ref<MidiMessagesBuffer>([]);
  const timeout = ref<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (buffer.value.length > 0) {
      onMessages(buffer.value);
      buffer.value = [];
    }
    timeout.value = null;
  };

  const listener = (message: number[], timestamp: number, device: string) => {
    buffer.value.push([message, timestamp, device]);
    if (!timeout.value) {
      timeout.value = setTimeout(flush, 0);
    }
  };

  onMounted(async () => {
    const store = useMidiMessagesStore();
    await store.subscribeToNamespace(namespace, listener);
  });

  onUnmounted(() => {
    const store = useMidiMessagesStore();
    store.unsubscribeFromNamespace(namespace, listener);
    if (timeout.value) {
      clearTimeout(timeout.value);
      timeout.value = null;
    }
  });
}

export default useMidiMessages;
