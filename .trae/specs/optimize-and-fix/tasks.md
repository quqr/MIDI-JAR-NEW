# Tasks

## 阶段一：严重安全漏洞修复（最高优先级）

- [x] Task 1: 修复文件系统 API 路径验证 — Electron 端
  - [x] 1.1: 在 `electron/main.ts` 的 `FILE_SYSTEM.READ_FILE` handler 中添加路径白名单验证，限制为 `app.getPath('userData')` 目录
  - [x] 1.2: 在 `electron/main.ts` 的 `FILE_SYSTEM.WRITE_FILE` handler 中添加同样的路径验证
  - [x] 1.3: 添加路径遍历攻击防护（`path.resolve` + `startsWith` 检查）

- [x] Task 2: 修复文件系统 API 路径验证 — Tauri 端
  - [x] 2.1: 在 `src-tauri/capabilities/default.json` 中为 `fs:allow-read-text-file` 和 `fs:allow-write-text-file` 添加 scope 限制（`$APPDATA/**`）
  - [x] 2.2: 在 `src-tauri/src/lib.rs` 的 `read_file`/`write_file` 命令中添加路径验证逻辑

- [x] Task 3: 修复 Electron IPC 安全问题
  - [x] 3.1: 在 `electron/preload.ts` 的 `on` 方法中添加 IPC 通道白名单过滤
  - [x] 3.2: 在 `electron/main.ts` 的 `secureOn` 中添加 `event.senderFrame.url` 验证
  - [x] 3.3: 移除 `electron/main.ts` 中无条件 `openDevTools()` 调用，改为仅开发环境执行

- [x] Task 4: 修复 URL 协议验证
  - [x] 4.1: 在 `electron/main.ts` 的 `SHELL.OPEN_EXTERNAL` handler 中添加 URL 协议白名单（仅允许 http/https）
  - [x] 4.2: 在 `src-tauri/src/lib.rs` 的 `open_external` 命令中添加同样的 URL 协议验证
  - [x] 4.3: 在 `src-tauri/capabilities/default.json` 中为 `opener:allow-open-url` 添加 URL scope 限制

- [x] Task 5: 修复 Tauri 安全配置
  - [x] 5.1: 将 `tauri.conf.json` 中 `withGlobalTauri` 设为 `false`
  - [x] 5.2: 在 `src/utils/tauri.ts` 中移除 `window.tauriAPI` 全局暴露，改用 scoped import
  - [x] 5.3: 在 Electron 和 Tauri 的 CSP 中补充 `object-src 'none'`、`base-uri 'self'`、`form-action 'self'`、`frame-ancestors 'none'`
  - [x] 5.4: 在 `.gitignore` 中添加 `.env`、`.env.local`、`.env.*.local`、`*.pem`、`*.key`、`*.cert` 等敏感文件模式

## 阶段二：严重功能 Bug 修复

- [x] Task 6: 修复 MIDI 消息接收失效
  - [x] 6.1: 在 `src/stores/midiMessages.ts` 的 `getManager` 函数中，创建 `InternalMidiMessages` 后立即调用 `initialize()`
  - [x] 6.2: 验证 `subscribeToNamespace` 调用后消息能正常接收

- [ ] Task 7: 实现物理 MIDI 输出消息转发
  - [ ] 7.1: 在 `src-tauri/src/midi/device_manager.rs` 中实现物理输出路由的 MIDI 消息转发逻辑
  - [ ] 7.2: 在 MIDI 回调中将消息发送到物理输出端口，而非仅发射 `midi:activity` 事件
  - [ ] 7.3: 测试物理输出路由功能

- [x] Task 8: 修复无限循环风险
  - [x] 8.1: 在 `src/composables/useQuiz/utils.ts` 的 `generateChords` 中添加最大重试次数（100 次）
  - [x] 8.2: 在 `getRandomChordInKey` 的 `while (!chordTypes.length)` 循环中添加最大重试次数
  - [x] 8.3: 超过重试次数时返回当前结果或抛出友好错误

- [x] Task 9: 修复路由同步时序问题
  - [x] 9.1: 在 `src/stores/midiRouting.ts` 中所有 `syncRoutesToMain()` 调用处添加 `await`
  - [x] 9.2: 修改 Electron 端 `MidiDeviceManager.ts` 的 `routeMidi` 方法，先断开旧连接再创建新连接
  - [ ] 9.3: 统一 Electron/Tauri 双后端 MIDI API 行为，确保 `getInputs`/`getOutputs`/`getWires` 均返回 Promise

## 阶段三：性能优化

- [ ] Task 10: I/O 操作防抖优化
  - [ ] 10.1: 为 `src/stores/settings.ts` 的 `watch(settings, ..., { deep: true })` 添加 300ms debounce
  - [ ] 10.2: 为 `src/stores/windowState.ts` 的 `watch(windowState, ..., { deep: true })` 添加 300ms debounce
  - [ ] 10.3: 为 `src/stores/midiRouting.ts` 的 `setNodePosition` 添加 debounce
  - [x] 10.4: 为 `electron/main.ts` 的 `resize`/`move` 事件添加 debounce
  - [ ] 10.5: 为 `src-tauri/src/lib.rs` 的 `Resized` 窗口事件添加防抖

- [ ] Task 11: PianoKeyboard 响应式重构
  - [ ] 11.1: 将 `PianoKeyboard.vue` 的 `applyHighlights` 从命令式 DOM 操作重构为响应式 `:class` 绑定
  - [ ] 11.2: 将 `utils.ts` 中的 `innerHTML` 替换为 `textContent`（同时修复 XSS 风险）
  - [ ] 11.3: 为 SVG 渐变 ID 添加动态唯一标识（`useId()`），修复多实例冲突
  - [ ] 11.4: 修复 Labels.vue 动态 class 拼接错误（`class="label-${noteDef.midi}"` → `:class`）
  - [ ] 11.5: 移除 `applyHighlights` 中 `displaySustained` 的冗余分支

- [ ] Task 12: MIDI 消息缓冲区优化
  - [ ] 12.1: 在 `src/stores/midiMessages.ts` 中将 `unshift`+`slice` 替换为环形缓冲区实现
  - [ ] 12.2: 在 `src/utils/logger.ts` 中同样替换为环形缓冲区

- [ ] Task 13: 重型组件延迟渲染
  - [ ] 13.1: 将 `ChordDetail.vue` 转位部分的 `v-show` 改为 `v-if`
  - [ ] 13.2: 为 Debugger 视图添加虚拟滚动或最大日志条数限制（500 条）
  - [ ] 13.3: 移除 PianoKeyboard 子组件中冗余的 CSS `@import`

- [ ] Task 14: Rust 端性能优化
  - [ ] 14.1: 将 `device_manager.rs` 中的正则表达式编译改为 `OnceCell` 常量
  - [ ] 14.2: 将 `blocking_pick_files`/`blocking_pick_file` 改为异步版本 `.pick_files().await`
  - [ ] 14.3: 将 `DEBUG_MIDI` 改为编译特性（feature flag）或环境变量控制

- [ ] Task 15: 生产环境调试输出清理
  - [x] 15.1: 在 `src/utils/tauri.ts` 中移除或条件化所有 `console.log` 调试输出
  - [ ] 15.2: 在 `src/midi/MidiMessageManager.ts` 中移除或条件化所有 `console.log`
  - [x] 15.3: 在 `electron/security.ts` 中将 IPC 通道日志限制为仅开发环境
  - [ ] 15.4: 在 Rust 端将 `DEBUG_MIDI` 改为条件编译

## 阶段四：中等优先级 Bug 修复

- [ ] Task 16: 修复 Vue 组件逻辑问题
  - [ ] 16.1: 修复 `ChordDictionary.vue` 的 `watchEffect` 导航循环风险，改用精确 `watch` + 防抖
  - [ ] 16.2: 修复 `useMidiLatency.ts` 中 `onUnmounted` 注册在 `onMounted` 内部的反模式
  - [ ] 16.3: 修复 `CircleFifths.vue` 的 `v-if`+`v-for` 同元素使用问题
  - [ ] 16.4: 修复 `ChordDictionaryModuleProvider.vue` 的手动 prop 同步反模式
  - [ ] 16.5: 修复 `ChordDictionary.vue` 中不必要的数组拷贝（`computed(() => arr.slice())`）

- [ ] Task 17: 修复工具函数问题
  - [ ] 17.1: 修复 `debounce.ts` 中 `immediate` 模式逻辑错误
  - [ ] 17.2: 将 `deepClone` 从 `JSON.parse(JSON.stringify())` 改为 `structuredClone()`
  - [ ] 17.3: 修复 `mergeDeep` 先 `deepClone` 再检查类型的性能浪费
  - [ ] 17.4: 修复 `utils.ts` 默认 locale 回退从 `"zh"` 改为 `"en"`

- [ ] Task 18: 修复内存泄漏
  - [ ] 18.1: 修复 `AppNavbar.vue` 窗口事件监听器未清理，保存 unlisten 函数并在 `onUnmounted` 中调用
  - [ ] 18.2: 修复 `CustomCursor.vue` 的 `requestAnimationFrame` 未取消
  - [ ] 18.3: 修复 `CircleFifths.vue` 的 resize 事件监听器清理不完整
  - [x] 18.4: 修复 `midiMessages.ts` 的 `managerMap`/`listenerMap` 未在 store 销毁时清理
  - [x] 18.5: 修复 `electron/preload.ts` 中 `onStateChanged`/`onMaximizedChanged` 监听器无取消函数

- [ ] Task 19: 修复 CircleFifths i18n 响应性问题
  - [ ] 19.1: 将 `CircleFifths/utils.ts` 中的 `DEGREE_NAMES` 和 `MODE_NAMES` 从模块级常量改为函数或 computed 属性
  - [ ] 19.2: 验证语言切换后五度圈度数名称和调式名称正确更新

## 阶段五：类型安全与代码质量

- [ ] Task 20: 类型安全强化
  - [ ] 20.1: 将 `src/types/tauri.d.ts` 中 14 处 `any` 替换为具体类型
  - [ ] 20.2: 合并 `src/types/index.ts` 与 `src/types/settings.ts` 中重复且不一致的类型定义
  - [ ] 20.3: 统一 `MidiMessageType`/`MidiMessageTuple`/`MidiMessage` 的重复定义
  - [ ] 20.4: 在 `eslint.config.js` 中将 `no-explicit-any` 设为 `"warn"`

- [ ] Task 21: 修复类型断言问题
  - [ ] 21.1: 修复 `ChordQuiz.vue` 和 `ChordDisplay.vue` 中的 `as any`/`as unknown as` 类型断言
  - [ ] 21.2: 修正 composable 返回类型使其与组件 prop 类型一致
  - [ ] 21.3: 修复 `ChordName.vue` 中的非空断言 `chord!.root` → `chord?.root`

- [ ] 22: 输入验证增强
  - [ ] 22.1: 为 `GeneralSettings.vue` 的服务器端口添加范围验证（1-65535）
  - [ ] 22.2: 为 `ChordSearch.vue` 的搜索输入添加 `maxlength` 限制
  - [ ] 22.3: 修复 `ChordIntervals.vue` 中无效的空 class 绑定

# Task Dependencies

- [Task 7] 依赖 [Task 6]（MIDI 消息接收修复后再实现物理输出）
- [Task 11] 依赖 [Task 12]（PianoKeyboard 重构前先优化消息缓冲区）
- [Task 20] 可与 [Task 21] 并行
- [Task 14] 可与 [Task 10-13] 并行（Rust 端独立）
- [Task 15] 可与 [Task 10-14] 并行（调试输出清理独立）
- [Task 16-19] 可并行执行（互不依赖）
