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

  /**
   * 添加一条 MIDI 消息到消息列表，超出 maxMessages 上限时自动裁剪最早的记录
   * @param message - MIDI 消息的字节数组
   * @param timestamp - 消息时间戳
   * @param device - 来源设备名称
   * @param namespace - 消息所属命名空间
   */
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

  /**
   * 释放并移除指定命名空间的 InternalMidiMessages 实例及引用计数
   * @param namespace - 需要清理的命名空间
   */
  function cleanupManager(namespace: string): void {
    const manager = managerMap.get(namespace);
    if (manager) {
      manager.dispose();
      managerMap.delete(namespace);
    }
    refCountMap.delete(namespace);
  }

  /**
   * 获取指定命名空间的 InternalMidiMessages 管理器。
   * 若管理器已被销毁则重新创建，若不存在则新建并初始化
   * @param namespace - 目标命名空间
   * @returns 初始化完成的 InternalMidiMessages 实例
   */
  async function getManager(namespace: string): Promise<InternalMidiMessages> {
    let manager = managerMap.get(namespace);

    if (manager && manager.isDisposed()) {
      managerMap.delete(namespace);
      refCountMap.delete(namespace);
      manager = undefined;
    }

    if (!manager) {
      manager = new InternalMidiMessages(namespace);
      managerMap.set(namespace, manager);
      refCountMap.set(namespace, 0);
      await manager.initialize();
    }

    return manager;
  }

  /**
   * 订阅指定命名空间的 MIDI 消息。同时将消息记录到 store 内部列表，
   * 并通过回调通知调用方。采用引用计数管理生命周期
   * @param namespace - 订阅的命名空间
   * @param onMessage - 消息回调函数
   */
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

  /**
   * 取消订阅指定命名空间的 MIDI 消息。
   * 当引用计数归零时自动释放对应的 InternalMidiMessages 管理器
   * @param namespace - 取消订阅的命名空间
   * @param onMessage - 之前注册的消息回调函数
   */
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

  /**
   * 重置 store：释放所有 InternalMidiMessages 管理器并清空消息列表
   */
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
