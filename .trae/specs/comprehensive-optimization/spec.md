# MIDI-JAR 全面优化方案 Spec

## Why

MIDI-JAR 作为一款成熟的 Tauri 桌面 MIDI 工具，在架构和功能上已有良好基础，但经过深度代码审查发现存在类型重复定义、全局变量污染、无测试覆盖、加载/错误状态缺失、Tailwind 配置版本不匹配等一系列影响可维护性、稳定性和用户体验的问题。本方案旨在系统性地解决这些问题，提升代码质量、用户界面和长期可维护性。

## What Changes

- 修复 src/types/ 中类型重复定义问题，统一为单一权威来源
- 消除 `window.tauriAPI` 全局变量污染，建立类型安全的 Tauri API 模块
- 移除生产环境中残留的调试日志
- 修复 `updateSetting` 等函数不必要的异步 Promise 包装
- 移除 `Utils` 类的过度设计，改为直接函数导出
- 修复 Tailwind v3 配置文件与 v4 包版本不匹配问题
- 添加 MIDI 路由等异步模块的加载状态和用户可见错误反馈
- 补充 ARIA 无障碍标签
- 添加设置自动保存的防抖机制以提升性能
- 引入 mitt 事件总线替代 `globalProperties.$emit` 跨组件通信
- 将和弦静态数据改为可懒加载的 JSON 模块
- 建立 vitest 单元测试基础设施
- 修复 `user-select: none` 对输入框的影响

## Impact

- Affected specs: 无（首次规范）
- Affected code: `src/types/`, `src/utils/tauri.ts`, `src/helpers/`, `src/stores/settings.ts`, `src/main.ts`, `tailwind.config.js`, `src/styles/tailwind.css`, `src/router/`, `src/views/Settings/Routing/`, `src/components/NavButton.vue`, `src/helpers/chords-data.ts`, `src/helpers/index.ts`

---

## ADDED Requirements

### Requirement: 类型系统统一

系统 SHALL 将 `src/types/settings.ts` 和 `src/types/index.ts` 中重复定义的类型合并，以 `src/types/settings.ts` 为权威来源，`src/types/index.ts` 通过 `export *` 重新导出。

#### Scenario: 类型定义不再重复

- **WHEN** 开发者修改一个 Settings 子类型
- **THEN** 只需在一处修改，所有引用自动更新

#### Scenario: MIDI Routes 类型正确归属

- **WHEN** `Settings` 类型需要包含 `midiRoutes` 字段
- **THEN** 该字段在 `src/types/settings.ts` 中定义，不再仅在 `index.ts` 中存在

---

### Requirement: Tauri API 类型安全封装

系统 SHALL 移除 `window.tauriAPI` 的 `any` 类型全局挂载，改为通过独立模块导出类型安全的 Tauri API 封装，所有 MIDI/JAR 前端代码通过 import 引用。

#### Scenario: 类型安全的 Tauri API 调用

- **WHEN** 开发者调用 `tauriAPI.midi.refreshDevices()`
- **THEN** IDE 提供完整的类型提示和自动补全
- **THEN** 在非 Tauri 环境下调用时，通过包装函数返回明确的错误而非抛出异常

---

### Requirement: 生产环境日志清理

系统 SHALL 移除 `src/utils/tauri.ts` 中所有 `console.log("[MIDI_DEBUG] ...")` 调试日志，仅保留通过 Logger 系统输出的结构化日志。

#### Scenario: 生产环境无调试日志

- **WHEN** 应用在生产模式下运行
- **THEN** 控制台不输出 `[MIDI_DEBUG]` 前缀的日志

---

### Requirement: 同步操作不应包装为异步

系统 SHALL 将 `useSettingsStore` 中 `updateSetting`、`updateSettings`、`resetSetting` 等同步操作的返回类型从 `Promise<void>` 改为 `void`。

#### Scenario: 同步设置更新

- **WHEN** 调用 `settingsStore.updateSetting("general.language", "zh-CN")`
- **THEN** 设置立即更新，无需 `await`

---

### Requirement: 移除过度设计的 Utils 类

系统 SHALL 将 `src/helpers/utils.ts` 中的 `Utils` class 替换为直接导出的函数。

#### Scenario: 直接函数调用

- **WHEN** 调用 `getCurrentLocale()`
- **THEN** 直接 import 并使用，无需通过 class 实例

---

### Requirement: Tailwind CSS 配置现代化

系统 SHALL 将 Tailwind 配置完全迁移到 v4 标准的 CSS 优先配置方式，移除不再被 v4 自动读取的 `tailwind.config.js`。

#### Scenario: Tailwind v4 配置正确加载

- **WHEN** Vite 开发服务器启动
- **THEN** Tailwind 工具类基于 `src/styles/tailwind.css` 中的 `@theme` 指令生成
- **THEN** 不再出现 v3 配置文件被忽略的警告

---

### Requirement: 异步模块加载与错误反馈

系统 SHALL 为 MIDI 路由初始化和其他异步操作提供用户可见的加载状态和错误提示。

#### Scenario: MIDI 路由加载中

- **WHEN** MIDI 路由页面正在初始化设备列表和路由配置
- **THEN** 显示加载指示器（spinner/skeleton）

#### Scenario: MIDI 设备刷新失败

- **WHEN** MIDI 设备列表刷新失败（如 Tauri 后端无响应）
- **THEN** 显示错误提示信息，并提供重试按钮

---

### Requirement: ARIA 无障碍增强

系统 SHALL 为 `NavButton` 和所有缺少 ARIA 标签的交互元素添加适当的 `aria-label` 属性。

#### Scenario: 导航按钮具有语义标签

- **WHEN** 屏幕阅读器聚焦到导航按钮
- **THEN** 读出对应的 `aria-label` 描述

---

### Requirement: 设置自动保存防抖

系统 SHALL 对 `useSettingsStore` 中的 `deep watch` 自动保存添加 500ms 防抖，减少频繁的 `localStorage` 写入。

#### Scenario: 快速连续修改设置

- **WHEN** 用户在 1 秒内快速拖动滑块或连续切换开关
- **THEN** `localStorage.setItem` 仅被调用 1-2 次（而非每次变更都写入）

---

### Requirement: 事件总线替代全局事件

系统 SHALL 引入 `mitt` 事件总线库，替代 `app.config.globalProperties.$emit` 用于跨组件通信，将 widget 恢复逻辑迁移至专用 composable。

#### Scenario: 文件打开事件通信

- **WHEN** Tauri 后端检测到文件拖放打开
- **THEN** 通过 mitt 事件总线向相关组件发送事件，而非通过 globalProperties

---

### Requirement: 和弦数据懒加载

系统 SHALL 将 `src/helpers/chords-data.ts` 中 564 行的静态数组重构为可懒加载的 JSON 数据模块，减少首屏加载体积。

#### Scenario: 首屏不加载完整和弦数据

- **WHEN** 用户打开应用首页
- **THEN** 和弦数据 JSON 在首次访问和弦词典功能时才加载

---

### Requirement: 单元测试基础设施

系统 SHALL 建立 vitest 单元测试基础设施，为核心工具函数（`mergeDeep`、`setValueByPath`、和弦检测算法）添加测试用例。

#### Scenario: 核心工具函数有测试覆盖

- **WHEN** 运行 `npx vitest run`
- **THEN** 至少对 `mergeDeep`、`setValueByPath`、和弦检测核心逻辑有测试覆盖并全部通过

---

### Requirement: user-select 修复

系统 SHALL 修复全局 `user-select: none` 对文本输入框的影响，将限制范围限定为非交互元素。

#### Scenario: 输入框可选择文本

- **WHEN** 用户聚焦到设置页面的文本输入框
- **THEN** 可以正常选择文本内容

---

## MODIFIED Requirements

无现有需求被修改。

## REMOVED Requirements

无现有需求被移除。
