# MIDI-JAR 迁移 GitHub Pages 可行性分析

> 基于项目源码深度审计（`src-tauri/src/lib.rs`、`src/utils/tauri.ts`、`src/stores/midiRouting.ts`、`src/midi/MidiMessageManager.ts`、`src/composables/`、`vite.config.ts`），结合 grill-me + wayfinder 决策流程，产出本报告。

---

## 一、结论总览

**可行，但有大量架构性改造。** 项目本身是 Vue 3 + Vite 的 SPA，构建产物已经是纯静态文件，具备部署 GitHub Pages 的基本条件。但 MIDI 硬件访问、路由引擎、窗口管理、Widget 系统、文件持久化全部依赖 Tauri Rust 后端，需要按以下决策逐项改造。

### 决策清单

| # | 决策 | 结论 |
|---|------|------|
| 1 | MIDI 硬件访问 | 使用 JZZ 库补齐 Web MIDI API |
| 2 | 路由模式 | `createWebHistory` → `createWebHashHistory` |
| 3 | 部署策略 | GitHub Actions 自动部署到 GitHub Pages |
| 4 | 窗口控件 | `v-if="isTauri()"` 条件隐藏 |
| 5 | 文件加载 | 封装 `useFilePicker` composable，双环境适配 |
| 6 | 浏览器兼容性 | JZZ 实现 MIDI 访问 + 不支持浏览器展示 banner |
| 7 | AudioContext 自动播放 | 应用启动遮罩 + `Tone.start()` |
| 8 | 构建产物体积 | 保持现有 `manualChunks`，上线后用 Lighthouse 评估 |
| 9 | MIDI 后端抽象 | `IMidiBackend` 接口，`TauriMidiBackend` / `WebMidiBackend` 双实现 |
| 10 | GitHub Pages 路径前缀 | 构建时 `--base=/MIDI-JAR-NEW/` |
| 11 | Widget 窗口 | 浏览器环境完全移除 |
| 12 | MIDI 路由引擎 | 浏览器环境完全移除（路由 UI、wires/routes 数据结构） |
| 13 | 窗口状态管理 | 浏览器环境移除 `windowState` store 及相关 UI |
| 14 | 文件持久化 | `localStorage` 统一存储方案 |
| 15 | `main.ts` 初始化 | `IMidiBackend` 工厂模式，根据环境选择后端 |
| 16 | Settings Routing 页面 | 浏览器环境隐藏，路由定义保留 |

---

## 二、项目现状分析

### 2.1 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 框架 | Vue 3 + Composition API | 3.5.39 |
| 构建 | Vite (Rolldown) | 8.1.5 |
| 状态 | Pinia | 4.0.2 |
| 路由 | Vue Router (`createWebHistory`) | 5.2.0 |
| 样式 | Tailwind CSS + DaisyUI | 4.x / 5.x |
| 国际化 | vue-i18n | 11.4.6 |
| 音频 | Tone.js | 15.1.22 |
| 记谱 | VexFlow | 5.0.0 |
| 和弦 | Tonal.js | 6.4.3 |
| MIDI 解析 | @tonejs/midi | 2.0.28 |
| 桌面 | Tauri 2.0 + Rust (midir) | 2.x |

### 2.2 当前架构

```
┌────────────────────────────────────────────────┐
│                  前端 (src/)                     │
│  Vue 3 SPA + Pinia + Vue Router                 │
│  路由: 14 条 (createWebHistory)                  │
│  CSS: Tailwind + DaisyUI + SCSS                 │
│  i18n: zh-CN / en                               │
└────────────┬───────────────────────────────────┘
             │ tauriAPI 全局单体
             │ invoke() + listen()
┌────────────▼───────────────────────────────────┐
│            Rust 后端 (src-tauri/)                │
│  25 个 Tauri 命令                                │
│  ┌──────────────────────────────────────┐       │
│  │ MIDI 子系统 (midir crate)             │       │
│  │  • 设备发现 (1000ms 轮询)             │       │
│  │  • 路由引擎 (input → output 转发)     │       │
│  │  • 消息去重 (5ms 窗口, 32 条缓存)     │       │
│  │  • 虚拟端口 (Unix/Windows)            │       │
│  │  • 内部模块 (chord-dictionary,        │       │
│  │              chord-display, debugger) │       │
│  └──────────────────────────────────────┘       │
│  • 窗口管理 (最小化/最大化/关闭/置顶/拖拽)        │
│  • 文件对话框 + 文件 I/O                        │
│  • Widget 多窗口系统                             │
│  • Shell 外部链接                                │
│  • 窗口状态持久化                                │
└────────────────────────────────────────────────┘
```

### 2.3 关键引用链

| Tauri API | Rust 命令 | 前端调用方 | 浏览器替代方案 |
|-----------|----------|-----------|---------------|
| `tauriAPI.app.getVersion` | `get_app_version` | 多处 | `import.meta.env.VITE_APP_VERSION` |
| `tauriAPI.app.getPlatform` | `get_platform` | 多处 | `navigator.platform` |
| `tauriAPI.app.quit` | - | 系统菜单 | `window.close()` (无实际效果) |
| `tauriAPI.window.*` | `is_maximized/get_window_state/set_always_on_top` | AppNavbar, windowState store | 移除 |
| `tauriAPI.fileSystem.*` | `open_file_dialog/read_file/write_file/save_file_dialog` | 文件加载 | `<input type="file">` + 拖拽 |
| `tauriAPI.midi.onInputs` | `get_inputs` + 事件推送 | midiRouting store | WebMidiBackend (JZZ) |
| `tauriAPI.midi.onOutputs` | `get_outputs` + 事件推送 | midiRouting store | WebMidiBackend (JZZ) |
| `tauriAPI.midi.onWires` | `get_wires` + 事件推送 | midiRouting store | 移除 |
| `tauriAPI.midi.onMidiMessage` | 事件推送 `midi:message:{ns}` | MidiMessageManager, 12 composables | WebMidiBackend (JZZ) |
| `tauriAPI.midi.onLatency` | 事件推送 `midi:activity` | useMidiLatency | 移除 (Web MIDI 无法精确测量) |
| `tauriAPI.midi.syncRoutes` | `sync_routes` | midiRouting store | 移除 |
| `tauriAPI.midi.*Virtual*` | `create_virtual_input` 等 | midiRouting store | JZZ 虚拟端口 |
| `tauriAPI.midi.refreshDevices` | `refresh_devices` | midiRouting store | JZZ `statechange` 事件 |
| `tauriAPI.shell.openExternal` | `open_external` | 外部链接 | `window.open(url, "_blank")` |
| Widget 命令 | `create_widget_window` 等 | Widget 系统 | 移除 |

### 2.4 已具备的有利条件

- **`base: "./"`** — Vite 配置已使用相对路径，天然适配 GitHub Pages 子目录
- **`isTauri()` 环境检测** — 已有运行时环境判断机制
- **`runInTauri()` 优雅降级** — 非 Tauri 环境的 fallback 模式
- **localStorage 数据持久化** — settings/routes/node-positions/viewport 已用 localStorage
- **代码分割** — manualChunks 已配置 (vue/tonal/vexflow/tone/vueflow)
- **静态构建产物** — `dist/` 包含 index.html + 59 个 JS/CSS 资源文件
- **无服务端 API** — 纯前端应用，无后端依赖

---

## 三、逐项决策详解

### 决策 1: Web MIDI API — JZZ

**背景**: 项目前端完全没用 `navigator.requestMIDIAccess()`，所有 MIDI 数据通过 Tauri 事件从 Rust 后端获取。

**方案**: 引入 JZZ 库作为浏览器端 MIDI 实现。

**JZZ vs 裸 Web MIDI API**:

| 维度 | 裸 Web MIDI API | JZZ |
|------|----------------|-----|
| 设备枚举 | 手动遍历 Map | `JZZ().info()` 统一 API |
| 消息解析 | 自己拆 `Uint8Array` | `JZZ.MIDI()` 内置解析 |
| 虚拟端口 | 不支持 | `JZZ.openMidiOut('Virtual')` |
| 错误处理 | 回调地狱 | Promise-based |
| 代码量 | 需自建完整封装 | 大部分现成 |

**限制**: JZZ 底层仍依赖 `navigator.requestMIDIAccess()`，仅 Chromium 系浏览器支持。

### 决策 2: Hash 路由

**背景**: 当前 `createWebHistory()` 需要服务端 URL 重写，GitHub Pages 不支持。

**方案**: 切换到 `createWebHashHistory()`，URL 变为 `/#/waterfall-piano`。

**代价**: 一行代码改动。URL 中带 `#`。

### 决策 3: GitHub Actions 自动部署

**方案**: 使用 `actions/deploy-pages` + `actions/configure-pages`。

**优势**:
- `dist/` 留在 `.gitignore`，源码仓库干净
- 每次 push main 自动构建部署
- 无需手动维护部署分支
- 一举两得搭好 CI 基础设施

### 决策 4: 窗口控件隐藏

**方案**: AppNavbar 中 `v-if="isTauri()"` 隐藏最小化/最大化/关闭按钮和窗口拖拽区域。

### 决策 5: 文件加载适配

**方案**: 封装 `useFilePicker` composable：
- Tauri 环境 → `tauriAPI.fileSystem.openFileDialog()`
- 浏览器环境 → `<input type="file" accept=".mid,.midi">` + 拖拽区域

### 决策 6: 浏览器兼容性

**方案**: 双策略。
1. 用 JZZ 实现 Web MIDI 访问（仅 Chromium 系浏览器支持）
2. 不支持的浏览器展示黄色 banner：
   > "当前浏览器不支持 Web MIDI API，请使用 Chrome 或 Edge 以获得完整 MIDI 体验"
3. MIDI 文件播放、和弦词典等纯软件功能不受影响

### 决策 7: AudioContext 自动播放

**方案**: 应用根组件加启动遮罩，用户首次点击时 `Tone.start()` 恢复 AudioContext，遮罩淡出。

```typescript
// App.vue
const handleFirstInteraction = async () => {
  await Tone.start();
  showOverlay.value = false;
};
```

### 决策 8: 构建体积

**现状**: vexflow 块 1.1MB，tone 块 341KB，总计约 2MB+。

**方案**: 保持现有 `manualChunks` 配置，上线后用 Lighthouse 跑实际瓶颈数据，再针对性优化。不做过早优化。

### 决策 9: MIDI 后端抽象

**方案**: 定义 `IMidiBackend` 接口，双实现。

```typescript
// src/midi/IMidiBackend.ts
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

// 浏览器环境不暴露这些方法:
// ❌ syncRoutes / addRoute / deleteRoute / clearRoutes
// ❌ getWires / onWires
// ❌ onLatency
```

```
┌──────────────┐     ┌──────────────┐
│ TauriMidi    │     │ WebMidi      │
│ Backend      │     │ Backend      │
│              │     │              │
│ invoke()     │     │ JZZ.js       │
│ listen()     │     │ requestMidi  │
│ tauriAPI     │     │ Access()     │
└──────┬───────┘     └──────┬───────┘
       │                    │
       └────────┬───────────┘
                │
       ┌────────▼────────┐
       │  IMidiBackend   │
       │  (interface)    │
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │ midiRouting     │
       │ store           │
       │ (只读设备数据)    │
       └─────────────────┘
```

### 决策 10: GitHub Pages 路径

**方案**: GitHub Actions 构建时 `vite build --base=/MIDI-JAR-NEW/`。

### 决策 11: Widget 窗口

**方案**: 浏览器环境完全移除。没有可用的浏览器多窗口 API 能替代 Tauri 的原生多窗口能力。

### 决策 12: MIDI 路由引擎

**方案**: 浏览器环境完全移除路由引擎。Web MIDI API 是直接设备到应用，没有中间路由层。

**移除的内容**:
- `midiRouting.syncRoutes/addRoute/deleteRoute/updateRoute/clearRoutes`
- `midiRouting.wires` 响应式数据
- `midiRouting.getWires/onWires`
- `@vue-flow` 路由拓扑图组件（如果仅用于路由）
- `TauriMidiBackend` 中的路由相关方法

**保留的内容**:
- `midiRouting.inputs/outputs`（只读设备列表）
- `midiRouting.initialize/refreshDevices`
- `MidiMessageManager`（MIDI 消息 → 内部模块的事件管道）

### 决策 13: 窗口状态管理

**方案**: 浏览器环境完全移除 `windowState` store 及关联 UI。

**移除**: `AppNavbar` 中的窗口控制按钮（`v-if="isTauri()"`）、`tauriAPI.window.*` 调用链。

### 决策 14: 文件持久化

**方案**: 统一使用 `localStorage`。settings/routes 已在用 `helpers/storage.ts`，无需改动。录音和 MIDI 文件数据也走 `localStorage`（5MB 限制可接受）。

### 决策 15: main.ts 初始化

**方案**: `IMidiBackend` 工厂模式。

```typescript
// src/main.ts
import { createMidiBackend } from '@/midi/backend';

const midiBackend = createMidiBackend(); // 内部根据 isTauri() 选择实现
await midiBackend.initialize();

// 如果是 WebMidiBackend，检查浏览器兼容性
if (!isTauri() && !midiBackend.isSupported()) {
  showBrowserWarning();
}
```

### 决策 16: Settings Routing 页面

**方案**: 浏览器环境隐藏 `/settings/routing` 菜单项，路由定义保留但不渲染。

---

## 四、改造范围估算

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/midi/IMidiBackend.ts` | Backend 接口定义 |
| `src/midi/TauriMidiBackend.ts` | 封装现有 `tauriAPI.midi.*` |
| `src/midi/WebMidiBackend.ts` | JZZ 实现浏览器 MIDI 访问 |
| `src/midi/backend.ts` | 工厂函数 `createMidiBackend()` |
| `src/composables/useFilePicker.ts` | 双环境文件选择 |
| `src/composables/useBrowserSupport.ts` | 浏览器能力检测 + banner 状态 |
| `.github/workflows/deploy.yml` | GitHub Actions 部署工作流 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/main.ts` | 后端工厂初始化，AudioContext 启动逻辑 |
| `src/router/index.ts` | `createWebHistory` → `createWebHashHistory` |
| `src/stores/midiRouting.ts` | 移除路由方法，通过 backend 获取设备数据 |
| `src/midi/MidiMessageManager.ts` | 改用 backend 的消息监听 |
| `src/views/Layout/AppNavbar.vue` | 窗口控件 `v-if="isTauri()"` |
| `src/App.vue` | AudioContext 启动遮罩 |
| `package.json` | 添加 `jzz` 依赖，添加 `build:gh-pages` 脚本 |
| `vite.config.ts` | 条件 base 路径 |
| `src/types/tauri.d.ts` | 类型更新 |

### 移除内容（浏览器环境）

| 内容 | 原因 |
|------|------|
| Widget 窗口系统 (`create_widget_window` 等 5 个命令) | 浏览器无多窗口能力 |
| MIDI 路由引擎 (`syncRoutes`/`addRoute`/`deleteRoute` 等) | Web MIDI 无路由概念 |
| 路由拓扑图 (`@vue-flow` 组件，如果仅用于路由) | 无路由数据 |
| `windowState` store 窗口管理功能 | 浏览器不能操作窗口 |
| 窗口控制按钮 (最小化/最大化/关闭/置顶/拖拽) | 无窗口控制 API |
| `useMidiLatency` 延迟监控 | 无法精确测量 |
| Settings Routing 页面 | 无路由功能 |

### 依赖变更

| 操作 | 包 | 原因 |
|------|----|------|
| 新增 | `jzz` | 浏览器 MIDI 实现 |
| 保留 | `@tonejs/midi` | MIDI 文件解析（纯 JS） |
| 保留 | `tone` | 音频引擎（Web Audio API） |
| 保留 | `vexflow` | 记谱渲染（Canvas） |
| 保留 | `@vue-flow/core` | 如果仅路由使用可移除，如果和弦显示也使用则保留 |

---

## 五、风险与限制

### 浏览器兼容性

| 功能 | Chrome | Edge | Firefox | Safari |
|------|--------|------|---------|--------|
| Web MIDI API (JZZ 底层) | ✅ 43+ | ✅ 79+ | ❌ | ❌ |
| Web Audio API (Tone.js) | ✅ | ✅ | ✅ | ✅ |
| AudioContext 自动播放限制 | ✅ 需用户手势 | ✅ 需用户手势 | ✅ 需用户手势 | ✅ 需用户手势 |
| AudioWorklet (Tone.js 内部) | ✅ | ✅ | ✅ | ✅ |
| Canvas/WebGL (VexFlow) | ✅ | ✅ | ✅ | ✅ |
| Service Worker (如后续加入) | ✅ | ✅ | ✅ | ✅ |

**结论**: MIDI 功能仅 Chrome/Edge 可用，其他浏览器提供降级体验。

### 功能差距

| 功能 | Tauri 桌面版 | 浏览器版 |
|------|------------|---------|
| 物理 MIDI 输入 | ✅ 所有设备 | ✅ 仅 Chrome/Edge |
| 物理 MIDI 输出 | ✅ 所有设备 | ✅ 仅 Chrome/Edge |
| MIDI 路由 (input→output 转发) | ✅ | ❌ 不可用 |
| 虚拟 MIDI 端口 | ✅ | ✅ JZZ 支持 |
| MIDI 消息去重 | ✅ Rust 端 5ms 窗口 | ❌ 需评估是否需要 |
| 延迟监控 | ✅ 微秒精度 | ❌ 不可用 |
| 窗口置顶 | ✅ | ❌ 不可用 |
| Widget 多窗口 | ✅ | ❌ 不可用 |
| MIDI 文件播放可视化 | ✅ | ✅ |
| 和弦检测/词典 | ✅ | ✅ |
| 音频引擎 | ✅ | ✅ |

---

## 六、实施路线图

### 阶段 1: 基础设施 (~2-3 天)

- [ ] 新增 `jzz` 依赖
- [ ] 创建 `IMidiBackend` 接口
- [ ] 创建 `TauriMidiBackend` (封装现有代码)
- [ ] 创建 `WebMidiBackend` (JZZ 实现)
- [ ] 创建 `backend.ts` 工厂函数
- [ ] 创建 `.github/workflows/deploy.yml`
- [ ] 切换 Hash 路由
- [ ] 配置条件 base 路径

### 阶段 2: 适配层 (~2-3 天)

- [ ] 重构 `midiRouting` store，通过 backend 获取数据
- [ ] 重构 `MidiMessageManager`，改用 backend 消息监听
- [ ] 重构 `main.ts` 初始化流程
- [ ] 封装 `useFilePicker` composable
- [ ] 封装 `useBrowserSupport` composable
- [ ] AppNavbar 窗口控件条件隐藏
- [ ] Settings Routing 页面条件隐藏

### 阶段 3: 用户体验 (~1 天)

- [ ] AudioContext 启动遮罩
- [ ] 浏览器不兼容 banner
- [ ] 文件拖拽区域
- [ ] 移除无窗口装饰的视觉空档

### 阶段 4: 清理 (~1 天)

- [ ] 移除浏览器不可用的 widget 相关代码引用
- [ ] 移除路由方法调用
- [ ] 移除 `useMidiLatency` 浏览器路径
- [ ] 类型清理
- [ ] `windowState` store 空实现

### 阶段 5: 验证 (~1-2 天)

- [ ] 本地 `npm run dev` 浏览器模式全流程测试
- [ ] `npm run build` + `npm run preview` 验证构建产物
- [ ] GitHub Actions 首次部署验证
- [ ] Chrome/Edge/Safari/Firefox 兼容性测试
- [ ] Lighthouse 性能基准

---

## 七、开发工作流

### 双环境开发

| 命令 | 环境 | 用途 |
|------|------|------|
| `npm run dev` | 浏览器 | Web 功能开发 |
| `npm run tauri:dev` | Tauri 桌面 | MIDI 硬件功能开发 |
| `npm run build` | 浏览器 | GitHub Pages 部署产物 |
| `npm run tauri:build` | Tauri 桌面 | 桌面应用打包 |

两个环境共享 Vite + Vue + Stores，通过 `IMidiBackend` 切换 MIDI 后端，互不干扰。

### 测试

| 环境 | MIDI backend | 测试内容 |
|------|-------------|---------|
| `npm run dev` | `WebMidiBackend` (或 Mock) | UI、路由、和弦、音频、文件播放 |
| `npm run tauri:dev` | `TauriMidiBackend` | MIDI 硬件、路由、设备管理 |
| Vitest (jsdom) | Mock | 单元测试（无 MIDI 依赖） |

---

## 八、总结

迁移到 GitHub Pages 在技术上**完全可行**。核心在于三点：

1. **MIDI 后端抽象** — `IMidiBackend` 接口是架构改造的核心，把 Tauri IPC 和 JZZ 统一在同一个契约下
2. **功能裁剪清醒决策** — 路由引擎、Widget 窗口、窗口状态管理在浏览器端不可用，果断移除而非假装适配
3. **部署自动化** — GitHub Actions 一次配置，零维护成本

预计改造工期 **7-10 天**，风险可控，Tauri 桌面版不受影响。
