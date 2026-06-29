# Checklist

## 阶段一：严重安全漏洞修复

- [ ] Electron 文件读写 API 添加路径白名单验证，限制为应用数据目录
- [ ] Tauri capabilities 文件系统权限添加 scope 限制
- [ ] Tauri lib.rs 文件读写命令添加路径验证逻辑
- [ ] Electron preload.ts `on` 方法添加 IPC 通道白名单过滤
- [ ] Electron main.ts `secureOn` 添加发送者验证
- [ ] Electron main.ts `openDevTools()` 仅在开发环境执行
- [ ] Electron `shell.openExternal` 添加 URL 协议白名单（仅 http/https）
- [ ] Tauri `open_external` 添加 URL 协议验证
- [ ] Tauri capabilities `opener:allow-open-url` 添加 URL scope 限制
- [ ] `tauri.conf.json` 中 `withGlobalTauri` 设为 `false`
- [ ] `window.tauriAPI` 全局暴露已移除或添加保护
- [ ] Electron 和 Tauri CSP 补充 `object-src 'none'`、`base-uri 'self'`、`form-action 'self'`、`frame-ancestors 'none'`
- [ ] `.gitignore` 添加 `.env`、证书文件等敏感文件模式

## 阶段二：严重功能 Bug 修复

- [ ] `InternalMidiMessages` 在 `getManager` 创建后调用 `initialize()`，MIDI 消息可正常接收
- [ ] Rust 端物理 MIDI 输出路由消息转发功能已实现
- [ ] `generateChords` 和 `getRandomChordInKey` 添加最大重试次数，无无限循环风险
- [ ] `midiRouting.ts` 中所有 `syncRoutesToMain` 调用均使用 `await`
- [ ] Electron 端 `routeMidi` 先断开旧连接再创建新连接
- [ ] Electron/Tauri 双后端 MIDI API 行为统一，`getInputs`/`getOutputs`/`getWires` 均返回 Promise

## 阶段三：性能优化

- [ ] settings.ts、windowState.ts、midiRouting.ts 的 localStorage 写入已添加 debounce
- [ ] Electron main.ts 的 resize/move 事件已添加 debounce
- [ ] Rust 端 Resized 窗口事件已添加防抖
- [ ] PianoKeyboard 组件已从命令式 DOM 操作重构为响应式 `:class` 绑定
- [ ] PianoKeyboard `innerHTML` 已替换为 `textContent`
- [ ] PianoKeyboard SVG 渐变 ID 已添加动态唯一标识
- [ ] PianoKeyboard Labels.vue 动态 class 绑定已修复
- [ ] PianoKeyboard 冗余 `displaySustained` 分支已移除
- [ ] midiMessages.ts 和 logger.ts 已使用环形缓冲区
- [ ] ChordDetail 转位部分 `v-show` 已改为 `v-if`
- [ ] Debugger 日志列表已添加虚拟滚动或最大条数限制
- [ ] PianoKeyboard 子组件冗余 CSS `@import` 已移除
- [ ] Rust 端正则表达式已预编译为 `OnceCell` 常量
- [ ] Rust 端 `blocking_pick_files` 已改为异步版本
- [ ] Rust 端 `DEBUG_MIDI` 已改为条件编译
- [ ] 生产环境所有 `console.log`/`eprintln!` 调试输出已移除或条件化

## 阶段四：中等优先级 Bug 修复

- [ ] ChordDictionary `watchEffect` 已改为精确 `watch` + 防抖
- [ ] `useMidiLatency` 中 `onUnmounted` 已移至 `setup` 阶段同步注册
- [ ] CircleFifths `v-if`+`v-for` 已重构为 `<template v-if>` 包裹
- [ ] ChordDictionaryModuleProvider 手动 prop 同步已重构为 computed/provide
- [ ] ChordDictionary 不必要的数组拷贝已移除
- [ ] `debounce.ts` `immediate` 模式逻辑已修复
- [ ] `deepClone` 已改用 `structuredClone()`
- [ ] `mergeDeep` 类型检查已移至 `deepClone` 之前
- [ ] 默认 locale 回退已改为 `"en"`
- [ ] AppNavbar 窗口事件监听器已在 `onUnmounted` 中清理
- [ ] CustomCursor `requestAnimationFrame` 已在 `onUnmounted` 中取消
- [ ] CircleFifths resize 事件监听器清理完整
- [ ] midiMessages store 的 `managerMap`/`listenerMap` 已在 store 销毁时清理
- [ ] Electron preload `onStateChanged`/`onMaximizedChanged` 已返回取消函数
- [ ] CircleFifths `DEGREE_NAMES`/`MODE_NAMES` 已改为响应式，语言切换后正确更新

## 阶段五：类型安全与代码质量

- [ ] `tauri.d.ts` 中 14 处 `any` 已替换为具体类型
- [ ] `index.ts` 与 `settings.ts` 重复类型定义已合并
- [ ] `MidiMessageType`/`MidiMessageTuple`/`MidiMessage` 重复定义已统一
- [ ] ESLint `no-explicit-any` 已设为 `"warn"`
- [ ] ChordQuiz/ChordDisplay 中的 `as any`/`as unknown as` 类型断言已消除
- [ ] ChordName `chord!.root` 已改为 `chord?.root`
- [ ] GeneralSettings 服务器端口已添加范围验证（1-65535）
- [ ] ChordSearch 搜索输入已添加 `maxlength` 限制
- [ ] ChordIntervals 空字符串 class 绑定已修复
