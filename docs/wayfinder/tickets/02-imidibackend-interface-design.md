# Ticket: IMidiBackend 接口重新设计

**Type**: grilling (HITL)
**Status**: open
**Blocked by**: (none) — 01 已解决，JZZ 排除，接口基于原生 Web MIDI API 设计

## Question

先期分析定义了 `IMidiBackend` 接口，但需要重新审视完整性：

1. 先期接口是否覆盖了所有现有 `tauriAPI.midi.*` 方法？逐一对照确认
2. 消息去重（Rust 端 5ms 窗口 + 32 条缓存）在 Web 端是否需要？如果需要，接口如何表达？
3. `MidiMessageManager` 当前通过 Tauri 事件命名空间 (`midi:message:{ns}`) 接收消息，WebMidiBackend 如何实现等价的消息路由？
4. `InternalMidiMessages`（内部模块 MIDI 消息，如 chord-dictionary/chord-display/debugger）在 Web 端如何传递？
5. 接口是否需要 `isSupported(): boolean` 方法用于浏览器能力检测？
6. 接口是否需要 `onDeviceChange()` 事件用于热插拔？
7. 错误处理策略：TauriMidiBackend 使用 invoke 错误，WebMidiBackend 使用 DOMException，如何统一？

### 先期接口参考

```typescript
interface IMidiBackend {
  getInputs(): Promise<MidiInput[]>;
  getOutputs(): Promise<MidiOutput[]>;
  onMidiMessage(namespace: string, callback: MidiMessageCallback): UnlistenFn;
  refreshDevices(): Promise<void>;
  isVirtualPortSupported(): boolean;
  createVirtualInput(name: string): Promise<void>;
  createVirtualOutput(name: string): Promise<void>;
  deleteVirtualInput(name: string): Promise<void>;
  deleteVirtualOutput(name: string): Promise<void>;
}
```

### 需要对照的现有 API

来自 `src/utils/tauri.ts` 的 `tauriAPI.midi`:
- refreshDevices, clearRoutes, addRoute, deleteRoute, syncRoutes
- getInputs, onInputs, getOutputs, onOutputs
- getWires, onWires, onLatency
- onMidiMessage
- isVirtualPortSupported, createVirtualInput/Output, deleteVirtualInput/Output
