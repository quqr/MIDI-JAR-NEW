import { onMounted, onUnmounted, ref } from "vue";
import { useMidiMessagesStore } from "@/stores/midiMessages";

export type MidiMessagesBuffer = Array<[number[], number, string]>;

/**
 * 批量监听 MIDI 消息：缓冲同一事件循环内的所有消息，在下一个微任务中一次性回调。
 * 避免高频 MIDI 消息导致的频繁渲染。
 *
 * @param onMessages - 批量消息回调，接收 [消息, 时间戳, 设备] 数组
 * @param namespace - MIDI 消息订阅的命名空间
 */
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
