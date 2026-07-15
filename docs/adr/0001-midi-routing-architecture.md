# ADR-0001: MIDI 路由架构

## 状态

已接受

## 背景

MIDI-JAR 需要管理多个 MIDI 输入设备到多个输出设备(包括物理设备和内部模块)的路由关系。系统需要:

1. 实时检测设备连接/断开
2. 支持动态创建/删除路由
3. 保证 MIDI 消息的低延迟传递
4. 提供可视化的路由图界面

## 决策

采用 **前后端分离** 的架构模式:

- **前端(Vue/Pinia)**: 管理路由配置和 UI 状态
- **后端(Rust)**: 管理实际的 MIDI 连接和消息传递
- **通信**: 通过 Tauri IPC 和事件系统同步状态

### 核心组件

1. **MidiRoutingStore (前端)**
   - 存储 `routes` 配置(用户定义的路由关系)
   - 存储 `wires` 状态(实际建立的连接)
   - 提供路由 CRUD 操作
   - 通过 `syncRoutesToMain()` 将配置同步到后端

2. **MidiDeviceManager (Rust)**
   - 使用 `midir` 库管理 MIDI 设备
   - 监听设备变化并发射事件到前端
   - 根据 `routes` 配置建立实际连接
   - 实现 MIDI 消息去重(避免重复触发)

3. **InternalMidiMessages (前端)**
   - 监听特定命名空间的 MIDI 消息
   - 使用 EventTarget 模式分发消息到订阅者
   - 支持模块化的消息订阅机制

### 数据流

```
用户操作 → MidiRoutingStore.addRoute()
         → syncRoutesToMain() (Tauri IPC)
         → MidiDeviceManager.route_midi() (Rust)
         → 建立 MidiInputConnection
         → MIDI 消息到达
         → Tauri 事件发射 (midi:message:{namespace})
         → InternalMidiMessages.dispatchEvent()
         → 模块处理消息
```

## 理由

### 为什么使用 Rust 后端处理 MIDI

1. **跨平台一致性**: `midir` 库提供统一的 MIDI API,无需处理 Windows/macOS/Linux 差异
2. **性能**: Rust 处理 MIDI 消息的性能优于 Node.js,避免 GC 停顿
3. **稳定性**: MIDI 连接在 Rust 层管理,即使前端重渲染也不会中断

### 为什么分离 routes 和 wires

- `routes`: 用户意图(配置)
- `wires`: 实际状态(连接是否成功)
- 分离后可以处理设备断开、连接失败等异常情况,而不丢失用户配置

### 为什么使用命名空间

- 多个模块(chord-dictionary, debugger, chord-display)需要接收 MIDI 消息
- 命名空间实现消息的订阅/过滤机制
- 避免全局广播的性能开销

## 后果

### 优点

1. **清晰的关注点分离**: 前端管理 UI/配置,后端管理连接/性能
2. **可扩展性**: 新增模块只需订阅新的命名空间
3. **容错性**: 前端崩溃不影响 MIDI 连接,后端重启可恢复状态

### 缺点

1. **复杂度**: 需要理解 Tauri IPC 和事件系统
2. **调试难度**: 需要同时查看前端和后端日志
3. **类型安全**: Tauri IPC 传递的数据需要手动类型断言

### 风险

1. **状态同步延迟**: 前端 `wires` 状态可能短暂落后于后端实际连接
   - 缓解: 后端立即发射 `midi:wires` 事件更新前端
2. **消息丢失**: 在建立连接期间可能丢失 MIDI 消息
   - 缓解: 后端使用 `MidiDedup` 缓存避免重复处理

## 替代方案

### 方案 A: 纯前端 Web MIDI API

- **优点**: 无需 Rust 后端,更简单
- **缺点**: 浏览器 API 限制,不支持虚拟 MIDI 端口,性能不如原生

### 方案 B: 所有逻辑在后端

- **优点**: 前端只负责 UI 渲染
- **缺点**: 失去 Vue 响应式系统的优势,UI 状态管理复杂

## 决策日期

2026-07-15

## 决策者

架构团队