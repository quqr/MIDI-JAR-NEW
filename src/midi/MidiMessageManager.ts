export type MidiMessageListener = (
  message: number[],
  timestamp: number,
  device: string,
) => void;

export class MidiMessageManager {
  private static instance: MidiMessageManager | null = null;
  private listeners: Map<string, Set<MidiMessageListener>> = new Map();
  private outputs: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): MidiMessageManager {
    if (!MidiMessageManager.instance) {
      MidiMessageManager.instance = new MidiMessageManager();
    }
    return MidiMessageManager.instance;
  }

  registerOutput(namespace: string, output: any): void {
    this.outputs.set(namespace, output);

    output.on(
      "message",
      (message: number[], timestamp: number, device: string) => {
        this.distributeMessage(namespace, message, timestamp, device);
      },
    );
  }

  subscribe(namespace: string, listener: MidiMessageListener): void {
    if (!this.listeners.has(namespace)) {
      this.listeners.set(namespace, new Set());
    }
    this.listeners.get(namespace)!.add(listener);
  }

  unsubscribe(namespace: string, listener: MidiMessageListener): void {
    const namespaceListeners = this.listeners.get(namespace);
    if (namespaceListeners) {
      namespaceListeners.delete(listener);
      if (namespaceListeners.size === 0) {
        this.listeners.delete(namespace);
      }
    }
  }

  private distributeMessage(
    namespace: string,
    message: number[],
    timestamp: number,
    device: string,
  ): void {
    const namespaceListeners = this.listeners.get(namespace);
    if (namespaceListeners) {
      for (const listener of namespaceListeners) {
        listener(message, timestamp, device);
      }
    }
  }

  getNamespaces(): string[] {
    return Array.from(this.outputs.keys());
  }

  getListenerCount(namespace: string): number {
    return this.listeners.get(namespace)?.size ?? 0;
  }

  clearNamespace(namespace: string): void {
    this.listeners.delete(namespace);
  }

  cleanup(): void {
    this.listeners.clear();
    this.outputs.clear();
  }
}
