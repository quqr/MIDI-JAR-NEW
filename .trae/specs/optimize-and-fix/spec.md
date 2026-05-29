# MIDI-JAR 性能优化与 Bug 修复 Spec

## Why
MIDI-JAR 作为实时 MIDI 工具应用，在高频 MIDI 消息场景下存在显著性能瓶颈（频繁同步 I/O、命令式 DOM 操作、无虚拟化长列表），同时存在多个严重安全漏洞（任意文件读写、IPC 通道无验证、生产环境 DevTools 暴露）和功能性缺陷（物理 MIDI 输出未实现、和弦检测无限循环风险、MIDI 消息接收失效），需要系统性优化和修复。

## What Changes

### 性能优化
- 所有 `localStorage` 写入操作添加 debounce，避免高频同步 I/O 阻塞主线程
- PianoKeyboard 组件从命令式 DOM 操作重构为 Vue 响应式 `:class` 绑定
- Debugger 日志列表添加虚拟滚动或最大条数限制
- ChordDetail 转位部分 `v-show` 改为 `v-if`，延迟渲染重型子组件
- MIDI 消息缓冲区从 `unshift`+`slice` 改为环形缓冲区
- 和弦检测算法添加 chroma 索引映射优化
- Rust 端正则表达式预编译为 `OnceCell` 常量
- 移除生产环境所有 `console.log`/`eprintln!` 调试输出
- 窗口 resize/move 事件添加 debounce
- PianoKeyboard 子组件移除冗余 CSS `@import`
- CircleFifths 模块级 i18n 常量改为响应式 computed

### Bug 修复
- **严重**: 修复 `InternalMidiMessages` 未调用 `initialize()` 导致 MIDI 消息无法接收
- **严重**: 实现 Rust 端物理 MIDI 输出消息转发（当前仅发射 activity 事件）
- **高**: 修复 `generateChords`/`getRandomChordInKey` 无限循环风险（添加最大重试次数）
- **高**: 修复 `midiRouting.ts` 中 `syncRoutesToMain` 未 `await` 导致路由状态不一致
- **高**: 修复 Electron 端 `routeMidi` 先创建新连接再断开旧连接的时序问题
- **中**: 修复 PianoKeyboard SVG 渐变 ID 全局冲突（使用动态 ID）
- **中**: 修复 Labels.vue 动态 class 拼接错误（模板字符串未使用 `:class`）
- **中**: 修复 ChordDictionary `watchEffect` 可能导致导航循环
- **中**: 修复 `useMidiLatency` 中 `onUnmounted` 注册在 `onMounted` 内部的反模式
- **中**: 修复 `debounce.ts` 中 `immediate` 模式逻辑错误
- **中**: 修复 `deepClone` 使用 `JSON.parse(JSON.stringify())` 的类型丢失问题
- **中**: 修复 CircleFifths `v-if`+`v-for` 同元素使用问题
- **中**: 修复 ChordDictionaryModuleProvider 手动 prop 同步反模式
- **低**: 修复 AppNavbar 窗口事件监听器未清理导致内存泄漏
- **低**: 修复 `useMidiActivity` 传入设备名但未使用的未完成功能

### 安全修复
- **严重**: Electron/Tauri 文件读写 API 添加路径白名单验证，限制为应用数据目录
- **严重**: Electron `preload.ts` `on` 方法添加 IPC 通道白名单过滤
- **严重**: 移除生产环境 `openDevTools()` 调用
- **高**: `shell.openExternal`/`open_external` 添加 URL 协议白名单验证（仅允许 http/https）
- **高**: Tauri capabilities `fs:allow-read-text-file`/`fs:allow-write-text-file` 添加 scope 限制
- **高**: `withGlobalTauri` 设为 `false`，改用 scoped import
- **高**: `opener:allow-open-url` 添加 URL scope 限制
- **中**: CSP 补充 `object-src 'none'`、`base-uri 'self'`、`form-action 'self'`、`frame-ancestors 'none'`
- **中**: `.gitignore` 添加 `.env`、证书文件等敏感文件模式
- **中**: ESLint `no-explicit-any` 规则设为 `"warn"`
- **中**: `tauri.d.ts` 中 14 处 `any` 替换为具体类型
- **中**: PianoKeyboard `innerHTML` 替换为 `textContent`
- **中**: GeneralSettings 服务器端口添加范围验证（1-65535）
- **低**: Electron `security.ts` 中生产环境移除 `console.log` IPC 通道日志
- **低**: `window.tauriAPI` 全局暴露添加保护或移除

### 兼容性修复
- 统一 Electron/Tauri 双后端 API 行为（`getInputs`/`getOutputs` 返回值一致性）
- Rust 端 `blocking_pick_files`/`blocking_pick_file` 改为异步版本
- 默认 locale 回退从 `"zh"` 改为 `"en"`
- 合并 `index.ts` 与 `settings.ts` 中重复且不一致的类型定义

## Impact
- Affected specs: MIDI 设备管理、路由系统、和弦检测、调试器、设置系统、窗口管理
- Affected code:
  - `src/stores/` — settings.ts, windowState.ts, midiRouting.ts, midiMessages.ts, chordDictionary.ts
  - `src/midi/` — MidiMessageManager.ts, MidiDeviceManager.ts
  - `src/composables/` — useNotes.ts, useQuiz/, useMidiLatency.ts, useMidiActivity.ts, useMidiMessage.ts
  - `src/helpers/` — debounce.ts, object.ts, chord-detect.ts
  - `src/components/` — PianoKeyboard/, CircleFifths/, ChordIntervals.vue
  - `src/views/` — ChordDictionary/, ChordDisplay/, ChordQuiz/, Settings/Debugger/, Settings/Routing/, Layout/
  - `src/utils/` — tauri.ts, utils.ts
  - `src/types/` — tauri.d.ts, index.ts, settings.ts
  - `electron/` — main.ts, preload.ts, security.ts, midi/
  - `src-tauri/src/` — lib.rs, midi/device_manager.rs, midi/mod.rs
  - 配置文件 — tauri.conf.json, capabilities/default.json, .gitignore, eslint.config.js

## ADDED Requirements

### Requirement: 性能优化 — I/O 防抖
系统 SHALL 对所有 `localStorage` 写入操作（settings、windowState、nodePositions）添加 debounce（建议 300ms），避免高频同步 I/O 阻塞主线程。

#### Scenario: 高频设置变更
- **WHEN** 用户快速连续修改设置项
- **THEN** localStorage 仅在最后一次变更后 300ms 写入一次

### Requirement: 性能优化 — PianoKeyboard 响应式重构
系统 SHALL 将 PianoKeyboard 组件的命令式 DOM 操作（`classList.add/remove`、`innerHTML`）重构为 Vue 响应式 `:class` 绑定，使 Vue 能够追踪 DOM 变更并进行增量更新。

#### Scenario: 多音符同时高亮
- **WHEN** 多个 MIDI 音符同时按下
- **THEN** PianoKeyboard 仅更新受影响的琴键 DOM 节点，而非全量 fade + highlight

### Requirement: 性能优化 — 日志虚拟化
系统 SHALL 对 Debugger 视图的日志列表实现虚拟滚动或限制最大渲染条数（建议 500 条），避免长时间运行后 DOM 节点无限增长。

#### Scenario: 长时间 MIDI 监控
- **WHEN** Debugger 运行超过 1 小时，累计日志超过 10000 条
- **THEN** DOM 中仅渲染可见区域的日志条目，内存占用保持稳定

### Requirement: 性能优化 — 重型组件延迟渲染
系统 SHALL 将 ChordDetail 转位部分的 `v-show` 改为 `v-if`，仅在用户展开时渲染 PianoKeyboard 和 Notation 组件。

#### Scenario: 查看和弦详情
- **WHEN** 用户选择一个 7 音和弦
- **THEN** 初始仅渲染原位钢琴键盘和五线谱，转位部分不渲染

### Requirement: 性能优化 — MIDI 消息环形缓冲区
系统 SHALL 将 `midiMessages.ts` 和 `logger.ts` 中的 `unshift`+`slice` 替换为环形缓冲区实现，避免 O(n) 数组操作。

#### Scenario: 高频 MIDI 消息
- **WHEN** MIDI 消息频率达到每秒 100 条
- **THEN** 消息缓冲区操作保持 O(1) 时间复杂度

### Requirement: 性能优化 — Rust 正则预编译
系统 SHALL 将 `device_manager.rs` 中每次 `refresh_inputs` 都重新编译的正则表达式改为 `OnceCell` 常量。

#### Scenario: 设备刷新循环
- **WHEN** 100ms 定时器触发设备刷新
- **THEN** 正则表达式仅编译一次，后续使用缓存实例

### Requirement: 性能优化 — 生产环境调试输出清理
系统 SHALL 移除或条件编译所有生产环境 `console.log`/`eprintln!` 调试输出，包括 `tauri.ts`、`MidiMessageManager.ts`、Rust 端 `DEBUG_MIDI` 相关输出。

#### Scenario: 生产环境运行
- **WHEN** 应用以生产模式运行
- **THEN** 控制台无调试日志输出，MIDI 消息处理无额外开销

### Requirement: Bug 修复 — MIDI 消息接收
系统 SHALL 确保 `InternalMidiMessages` 在 `getManager` 创建后立即调用 `initialize()`，使 Tauri 事件监听器正确注册，MIDI 消息可正常接收。

#### Scenario: 订阅 MIDI 消息
- **WHEN** 前端调用 `subscribeToNamespace` 订阅 MIDI 消息
- **THEN** 消息监听器正确注册，后续 MIDI 消息能被接收

### Requirement: Bug 修复 — 物理 MIDI 输出
系统 SHALL 实现 Rust 端物理 MIDI 输出路由的消息转发功能，当前仅发射 `midi:activity` 事件，未将消息发送到物理输出端口。

#### Scenario: 路由到物理输出
- **WHEN** 用户创建从虚拟输入到物理输出的 MIDI 路由
- **THEN** MIDI 消息被正确转发到物理输出端口

### Requirement: Bug 修复 — 无限循环防护
系统 SHALL 为 `generateChords` 和 `getRandomChordInKey` 添加最大重试次数（建议 100 次），防止在极端条件下进入无限循环。

#### Scenario: 仅有一种和弦可用
- **WHEN** 和弦测验难度设置过低，仅有一种和弦满足条件
- **THEN** 超过最大重试次数后返回当前和弦，而非无限循环

### Requirement: Bug 修复 — 路由同步时序
系统 SHALL 确保 `midiRouting.ts` 中所有调用 `syncRoutesToMain` 的位置均使用 `await`，避免路由状态不一致。

#### Scenario: 快速连续添加路由
- **WHEN** 用户快速连续添加多条 MIDI 路由
- **THEN** 每条路由按顺序同步到主进程，状态一致

### Requirement: Bug 修复 — Electron 路由时序
系统 SHALL 修改 Electron 端 `routeMidi` 为先断开旧连接再创建新连接，避免短暂的消息重复或端口冲突。

#### Scenario: 更新 MIDI 路由
- **WHEN** 用户修改现有 MIDI 路由配置
- **THEN** 旧连接先断开，再建立新连接，无消息重复

### Requirement: Bug 修复 — SVG 渐变 ID 冲突
系统 SHALL 为 PianoKeyboard 的 SVG 渐变 ID 添加动态唯一标识（如 `useId()`），避免多实例时 ID 冲突。

#### Scenario: 多个 PianoKeyboard 实例
- **WHEN** 页面上同时渲染多个 PianoKeyboard 组件
- **THEN** 每个实例的 SVG 渐变独立，互不影响

### Requirement: Bug 修复 — Labels class 绑定
系统 SHALL 将 PianoKeyboard Labels 组件中的静态 `class="label-${noteDef.midi}"` 改为动态 `:class` 绑定。

#### Scenario: 钢琴键盘标签渲染
- **WHEN** PianoKeyboard 渲染琴键标签
- **THEN** 每个标签正确应用对应的动态 CSS class

### Requirement: Bug 修复 — debounce immediate 模式
系统 SHALL 修复 `debounce.ts` 中 `immediate` 模式的逻辑错误，确保 `immediate` 为 true 时函数在首次调用时立即执行。

#### Scenario: 使用 immediate 模式
- **WHEN** 以 `immediate: true` 调用 debounce 包装的函数
- **THEN** 函数在首次触发时立即执行

### Requirement: 安全修复 — 文件系统路径验证
系统 SHALL 为 Electron 和 Tauri 的文件读写 API 添加路径白名单验证，仅允许访问应用数据目录或用户通过文件对话框选择的路径。

#### Scenario: 尝试读取系统敏感文件
- **WHEN** 渲染进程尝试读取 `/etc/passwd` 或 `~/.ssh/id_rsa`
- **THEN** API 拒绝访问并返回错误

### Requirement: 安全修复 — IPC 通道验证
系统 SHALL 为 Electron `preload.ts` 的 `on` 方法添加 IPC 通道白名单过滤，仅允许监听预定义的安全通道。

#### Scenario: 恶意脚本尝试监听 IPC
- **WHEN** 渲染进程中的恶意代码尝试监听未授权的 IPC 通道
- **THEN** 监听请求被拒绝

### Requirement: 安全修复 — 生产环境 DevTools
系统 SHALL 将 `electron/main.ts` 中的 `openDevTools()` 调用限制为仅开发环境执行。

#### Scenario: 生产环境启动
- **WHEN** 应用以生产模式启动
- **THEN** DevTools 不自动打开

### Requirement: 安全修复 — URL 协议验证
系统 SHALL 为 Electron `shell.openExternal` 和 Tauri `open_external` 添加 URL 协议白名单验证，仅允许 `http://` 和 `https://` 协议。

#### Scenario: 尝试打开危险协议 URL
- **WHEN** 尝试打开 `file:///etc/passwd` 或 `javascript:alert(1)`
- **THEN** 请求被拒绝并记录安全日志

### Requirement: 安全修复 — Tauri 权限最小化
系统 SHALL 为 Tauri capabilities 添加文件系统 scope 限制和 URL 协议限制，并将 `withGlobalTauri` 设为 `false`。

#### Scenario: 渲染进程尝试访问未授权文件
- **WHEN** 前端代码尝试读取应用数据目录外的文件
- **THEN** Tauri API 拒绝访问

### Requirement: 安全修复 — CSP 强化
系统 SHALL 在 Electron 和 Tauri 的 CSP 中补充 `object-src 'none'`、`base-uri 'self'`、`form-action 'self'`、`frame-ancestors 'none'` 指令。

#### Scenario: 尝试注入外部资源
- **WHEN** 恶意代码尝试加载插件或提交表单到外部域
- **THEN** CSP 阻止该行为

### Requirement: 兼容性修复 — 双后端 API 统一
系统 SHALL 统一 Electron 和 Tauri 双后端的 MIDI API 行为，确保 `getInputs`/`getOutputs`/`getWires` 在两个平台上均返回 Promise。

#### Scenario: 在 Electron 环境获取 MIDI 设备
- **WHEN** 前端在 Electron 环境调用 `getInputs()`
- **THEN** 返回 Promise，与 Tauri 环境行为一致

### Requirement: 兼容性修复 — Rust 异步 API
系统 SHALL 将 Rust 端 `blocking_pick_files`/`blocking_pick_file` 改为异步版本 `.pick_files().await`，避免阻塞 tokio 运行时。

#### Scenario: 在 Tauri 环境打开文件对话框
- **WHEN** 用户打开文件选择对话框
- **THEN** 对话框使用异步 API，不阻塞其他操作

## MODIFIED Requirements

### Requirement: 类型安全
`tauri.d.ts` 中所有 `any` 类型 SHALL 替换为具体类型（`MidiInput`、`MidiOutput`、`MidiWire`、`MidiRoute` 等），`index.ts` 与 `settings.ts` 中重复且不一致的类型定义 SHALL 合并为单一来源。

### Requirement: 深拷贝实现
`deepClone` SHALL 使用 `structuredClone()` 替代 `JSON.parse(JSON.stringify())`，正确处理 `undefined`、`Date`、`Map`、`Set` 等类型。

### Requirement: 默认语言
默认 locale 回退 SHALL 从 `"zh"` 改为 `"en"`，对非中文用户更友好。

## REMOVED Requirements

### Requirement: 生产环境调试输出
**Reason**: 调试输出在生产环境中无必要，且影响性能和安全
**Migration**: 通过环境变量或编译特性控制，仅开发环境启用
