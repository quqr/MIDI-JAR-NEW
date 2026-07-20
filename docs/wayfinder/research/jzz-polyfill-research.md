# JZZ Polyfill 能力研究报告

> 研究日期：2026-07-20
> 针对项目：MIDI-JAR-NEW

---

## 1. JZZ 的 Polyfill 机制：当 Web MIDI API 不可用时发生了什么？

### 核心结论：JZZ **不是**真正的硬件 MIDI polyfill，而是一个依赖 Jazz-Plugin/浏览器扩展的桥接层 + 软件 MIDI 引擎

JZZ 在浏览器环境中的行为取决于检测到的运行时能力，按以下优先级降级：

| 优先级 | 检测条件 | 行为 |
|--------|----------|------|
| 1 | 浏览器原生支持 `navigator.requestMIDIAccess` | 直接使用浏览器原生 Web MIDI API |
| 2 | 检测到 Jazz-MIDI 浏览器扩展（Chrome/Firefox/Safari） | 通过扩展的 messaging 接口桥接到 OS 级 MIDI 子系统 |
| 3 | 检测到 Jazz-Plugin（NPAPI 插件，已过时） | 通过 NPAPI 插件桥接到 OS 级 MIDI 子系统 |
| 4 | 以上均不可用 | **降级为纯软件 MIDI 引擎**：无硬件设备枚举，无物理端口访问，仅能使用虚拟端口（JZZ.Widget）、软件合成器（JZZ.synth.OSC）、MIDI 文件播放等软件侧功能 |

### 关键发现

- JZZ 的文档声称 "enables Web MIDI API in browsers that don't support it"，但实际上这种"启用"**严重依赖 Jazz-Plugin 或浏览器扩展**。
- **没有 Jazz-Plugin/扩展的情况下，JZZ 无法在不支持 Web MIDI API 的浏览器上访问任何物理 MIDI 设备**。
- Jazz-Plugin 是一个 **NPAPI 插件**，而 NPAPI 已被所有现代浏览器弃用（Chrome 2015年移除，Firefox 2017年移除）。
- Jazz-MIDI 浏览器扩展是 Jazz-Plugin 的现代替代品，但需要用户**手动安装**，这是严重的用户体验障碍。

### 代码层面的证据

JZZ 官方文档明确写道：
> "For the best user experience, it's **highly RECOMMENDED (though not required)** to install the latest version of Jazz-Plugin and browser extensions..."

注意"not required"——不安装时 JZZ 仍可运行，但**只能作为软件 MIDI 引擎**，无法访问物理设备。

---

## 2. JZZ 在 Firefox/Safari 上的硬件 MIDI 访问能力

### Firefox

| 条件 | 能否访问物理 MIDI 设备 |
|------|----------------------|
| Firefox 108+（默认配置） | ✅ **可以** — Firefox 108+ 原生支持 Web MIDI API，但首次使用需安装 Site Permission Add-On |
| Firefox 108+ + JZZ（无扩展） | ✅ 可以 — JZZ 检测到原生 Web MIDI API 后直接使用 |
| Firefox < 108 + Jazz-MIDI 扩展 | ✅ 可以 — 通过扩展桥接 |
| Firefox < 108 + Jazz-Plugin（NPAPI） | ⚠️ 理论可行 — 但 Firefox 早已移除 NPAPI 支持，此路径已断 |
| Firefox < 108 + 无扩展/插件 + JZZ | ❌ **不可以** — JZZ 降级为软件引擎 |

### Safari

| 条件 | 能否访问物理 MIDI 设备 |
|------|----------------------|
| Safari（任何版本，macOS） | ❌ **不可以** — Apple 以指纹追踪安全为由拒绝实现 Web MIDI API |
| Safari + Jazz-MIDI 扩展（macOS App Store） | ✅ 可以 — 通过扩展桥接 |
| Safari + JZZ（无扩展） | ❌ **不可以** — JZZ 降级为软件引擎 |
| Safari iOS | ❌ **不可以** — iOS Safari 不支持 Web MIDI，也无 Jazz-MIDI 扩展 |
| Safari 17+（部分 MIDI 输入支持） | ⚠️ 有限 — macOS Ventura/iOS 17 有极有限的 MIDI 输入支持，但不完整 |

### 关键结论

- **Firefox 108+ 已经原生支持 Web MIDI API**，JZZ 在此场景下提供的是附加功能（虚拟端口、辅助函数等），而非核心硬件访问能力。
- **Safari 是 Web MIDI 的最大盲区**。JZZ 唯一能帮助 Safari 用户访问物理设备的途径是让他们安装 Jazz-MIDI 扩展，这对普通用户来说几乎不可行。
- 在 Firefox/Safari 上，JZZ 的"polyfill"更准确的说法是"软件 MIDI 降级引擎"，而非硬件 MIDI 访问桥接。

---

## 3. JZZ npm 包状态

| 指标 | 数据 |
|------|------|
| 当前版本 | 1.9.6 |
| 最后发布日期 | 2025-09-20（约 10 个月前） |
| 发布频率 | 2025 年发布 9 个版本，2024 年发布约 8 个版本 |
| 周下载量 | ~18,700 |
| GitHub Stars | 589 |
| GitHub Forks | 30 |
| GitHub Open Issues | 19 |
| GitHub Open PRs | 0 |
| 维护者数量 | 1（jazz-soft，即 Sema Kachalo） |
| 许可证 | MIT |
| 运行时依赖 | 1 个（jazz-midi） |
| 被依赖项目 | 49 个 |
| 累计版本数 | 195 |

### 安全状态

- **Snyk 扫描**：0 个已知漏洞（截至 v1.9.6）
- **npm audit**：无已知安全问题
- Snyk 安全评分：61/100

### 维护状态评估

- **Snyk 标记为 "Inactive"** — 过去 6 个月无 commit
- 最后 commit 约 5 个月前
- 单人维护项目，有 19 个未解决的 issue，0 个 PR
- 发布节奏仍然存在（2025 年有 9 个版本），但 GitHub 活跃度在下降
- **风险**：单人维护，如果维护者停止工作，项目将无人接手

---

## 4. JZZ vs 原生 Web MIDI API 对比

基于 MIDI-JAR-NEW 项目需求的逐项对比：

| 需求 | 原生 Web MIDI API | JZZ |
|------|-------------------|-----|
| **MIDI 设备枚举** | ✅ `midiAccess.inputs` / `midiAccess.outputs` | ✅ `JZZ().info()` + Web MIDI API 兼容 |
| **设备热插拔检测** | ✅ `midiAccess.onstatechange` | ✅ `JZZ().onChange()` + 自动桥接原生事件 |
| **MIDI 消息发送** | ✅ `output.send(data)` | ✅ `port.send()` + 链式语法 + 辅助函数 |
| **MIDI 消息接收** | ✅ `input.onmidimessage` | ✅ `port.connect(callback)` |
| **虚拟 MIDI 端口** | ❌ 不支持 | ✅ `JZZ.Widget()` + `JZZ.addMidiIn/Out()` |
| **Promise-based API** | ✅ `navigator.requestMIDIAccess()` 返回 Promise | ✅ `JZZ()` 返回 thenable，支持 async/await |
| **MIDI 消息解析** | ❌ 需手动解析 Uint8Array | ✅ 内置解析器，`.toString()`, `.getNote()`, `.getChannel()` 等 |
| **链式/流式操作** | ❌ 命令式 API | ✅ `.noteOn().wait(500).noteOff()` |
| **MIDI 2.0 / UMP** | ❌ 不支持 | ✅ `.MIDI2()`, `.umpNoteOn()` 等 |
| **MPE 支持** | ❌ 需手动实现 | ✅ `JZZ.MPE` 模块 |
| **MIDI 文件支持** | ❌ 不相关 | ✅ `jzz-midi-smf` 模块 |
| **跨浏览器硬件访问** | ⚠️ 仅 Chromium + Firefox 108+ | ⚠️ 同样仅 Chromium + Firefox 108+（无扩展时） |
| **包体积** | 0（浏览器内置） | ~50KB minified |
| **TypeScript 支持** | ✅ 内置 DOM 类型 | ✅ `index.d.ts` |
| **Safari 硬件访问** | ❌ | ❌（除非安装扩展） |

### JZZ 的附加价值分析

**JZZ 确实有价值的场景：**
- 需要虚拟 MIDI 端口（如内部路由、测试）
- 需要丰富的 MIDI 消息解析和辅助函数
- 需要链式异步操作语法
- 需要 MIDI 2.0 / UMP 支持
- 需要 MPE 支持
- 需要 Node.js 端的 MIDI 访问（通过 jazz-midi 原生模块）

**JZZ 没有额外价值的场景：**
- 只需要基本的硬件 MIDI 设备枚举和消息收发
- 目标浏览器已经支持 Web MIDI API
- 不想引入额外依赖和抽象层

---

## 5. 替代方案

### 5.1 Jazz-Plugin / Jazz-MIDI 浏览器扩展

- **开发者**：Jazz-Soft（与 JZZ 同一作者）
- **性质**：浏览器扩展 + NPAPI 插件（已过时）
- **Firefox 扩展状态**：Web MIDI API 扩展已于 **2025-04-26 从 Firefox Add-ons Store 下架**，风险评级为 "Moderate risk impact, High risk likelihood"
- **Chrome 扩展**：仍在 Chrome Web Store 可用
- **Safari 扩展**：在 macOS App Store 可用（Jazz-MIDI）
- **评价**：这是 JZZ 硬件访问能力的核心依赖。但扩展安装是用户行为，开发者无法控制。Firefox 扩展下架是一个严重警告信号。

### 5.2 Web MIDI API Shim（web-midi-api-shim）

- **作者**：Chris Wilson（Web MIDI API 规范共同作者）
- **状态**：**已弃用（deprecated）**，官方推荐使用 JZZ 替代
- **npm 页面说明**："Please use JZZ for enabling MIDI in browsers that do not support the WebMIDI API: npm install jzz"
- **结论**：不可用，已被 JZZ 取代

### 5.3 WebMidi.js

- **当前版本**：3.x（最新分支）
- **性质**：Web MIDI API 的高级封装库
- **浏览器支持**：仅支持原生 Web MIDI API 的浏览器（Chrome、Edge、Opera、Firefox 108+）
- **Safari 支持**：不支持，同样需要 Jazz-Plugin
- **特点**：更现代的 API 设计，事件驱动，TypeScript 支持更好
- **局限性**：不提供 polyfill，不做硬件访问桥接
- **评价**：如果只需要在支持的浏览器上使用更友好的 API，WebMidi.js 是比 JZZ 更轻量的选择

### 5.4 midiwire

- **当前版本**：0.13.2（pre-1.0，API 可能随时变化）
- **性质**：声明式 Web MIDI 控制器库
- **特点**：零依赖，支持 HTML 声明式绑定，14-bit CC，热插拔，SysEx
- **浏览器支持**：仅 Chrome、Firefox、Opera（依赖原生 Web MIDI API）
- **评价**：API 不稳定，不适合生产环境

### 5.5 kommidi

- **当前版本**：0.1.0
- **性质**：TypeScript MIDI 处理管道库
- **特点**：Pipeline 架构，MIDI 文件 I/O，录制/播放，Node.js 支持
- **浏览器支持**：Chrome、Edge、Firefox、Safari 17+（需用户授权）
- **评价**：极早期版本，无依赖者，不适合生产环境

### 5.6 WebUSB / Web Bluetooth MIDI

- **原理**：绕过 Web MIDI API，直接通过 WebUSB 或 Web Bluetooth 与 MIDI 设备通信
- **可行性**：理论可行，但需要为每种 MIDI 设备实现 USB/BLE 协议栈
- **现实性**：极低。MIDI USB 设备使用标准 USB MIDI 类协议，但 WebUSB 不能访问已由操作系统驱动程序的设备
- **结论**：不可行作为通用方案

---

## 6. 底线建议

### 现实评估

**残酷的事实**：在不支持 Web MIDI API 的浏览器上，**没有任何纯 JavaScript 方案能访问物理 MIDI 设备**。这是浏览器安全沙箱的根本限制，不是库的能力问题。JZZ 的"polyfill"需要用户安装浏览器扩展才能实现硬件访问，这不是真正的 polyfill。

### 推荐策略：分层架构 + 优雅降级

```
┌─────────────────────────────────────────────┐
│           MIDI-JAR-NEW MIDI 层              │
├─────────────────────────────────────────────┤
│                                             │
│  ① 优先使用原生 Web MIDI API               │
│     Chrome 43+ / Edge 79+ / Opera 30+      │
│     Firefox 108+ / Samsung Internet 4+     │
│                                             │
│  ② 检测到不支持时：                         │
│     - 显示清晰的浏览器兼容性提示             │
│     - 推荐用户切换到支持的浏览器             │
│     - 可选：提示安装 Jazz-MIDI 扩展          │
│                                             │
│  ③ 软件 MIDI 功能始终可用：                  │
│     - MIDI 文件解析/播放                     │
│     - 虚拟键盘输入                           │
│     - 内置合成器（Web Audio API）            │
│     - MIDI 消息可视化/分析                   │
│                                             │
└─────────────────────────────────────────────┘
```

### 具体建议

**不建议全面采用 JZZ，理由：**

1. **JZZ 不是真正的 polyfill** — 无扩展时无法在不支持的浏览器上访问硬件
2. **JZZ 的 API 是自定义的链式语法** — 与 Web MIDI API 标准不同，增加学习成本
3. **包体积开销** — ~50KB minified，对核心功能来说是过度包装
4. **维护风险** — 单人维护，Snyk 标记为 Inactive，Firefox 扩展已下架
5. **抽象层开销** — 对实时 MIDI 应用可能有延迟影响

**建议方案：直接使用原生 Web MIDI API + 轻量封装**

1. **核心层**：直接使用 `navigator.requestMIDIAccess()`，零依赖
2. **封装层**：自行编写轻量工具函数（消息解析、Promise 封装、设备枚举）
3. **降级层**：检测浏览器支持，不支持时展示提示而非静默降级
4. **软件 MIDI 层**：使用 Web Audio API + Tone.js 实现合成器功能，与硬件 MIDI 无关

**如果确实需要 JZZ 的某些功能，按需引入子模块：**

- 需要 MIDI 文件支持 → `jzz-midi-smf`
- 需要虚拟端口 → `JZZ.Widget()`（但考虑是否真的需要）
- 需要 MIDI 2.0 UMP → 评估是否是近期的实际需求

### 浏览器兼容性现实

| 浏览器 | 市场份额 | Web MIDI 支持 | 策略 |
|--------|---------|--------------|------|
| Chrome | ~75% | ✅ 原生支持 | 完全支持 |
| Edge | ~10% | ✅ 原生支持 | 完全支持 |
| Safari | ~5% | ❌ 不支持 | 显示兼容性提示 |
| Firefox | ~4% | ⚠️ 108+ 支持 | 基本支持 |
| Opera | ~2% | ✅ 原生支持 | 完全支持 |

**约 87%+ 的桌面浏览器原生支持 Web MIDI API**，Safari 是唯一的主要盲区。为 Safari 用户的硬件 MIDI 访问引入 JZZ 的收益不值得其代价。

### 最终结论

> **直接使用原生 Web MIDI API。为不支持的浏览器提供清晰的兼容性提示和软件 MIDI 降级体验（合成器/虚拟键盘/MIDI 文件），而非试图通过 JZZ 做无法真正实现的硬件 polyfill。**

---

## 参考来源

- JZZ 官方文档：https://jazz-soft.net/doc/JZZ/
- JZZ Web MIDI API 文档：https://jazz-soft.net/doc/JZZ/webmidi.html
- JZZ npm 页面：https://www.npmjs.com/package/jzz
- JZZ GitHub：https://github.com/jazz-soft/JZZ
- Snyk 安全扫描：https://security.snyk.io/package/npm/jzz
- Web MIDI API 浏览器兼容性：https://www.testmuai.com/learning-hub/web-midi-api-browser-support/
- Firefox Web MIDI 支持：https://www.testmuai.com/web-technologies/midi-firefox/
- Web MIDI API Shim（已弃用）：https://www.npmjs.com/package/web-midi-api-shim
- WebMidi.js 文档：https://webmidijs.org/docs/archives/v2/
- Jazz-MIDI Firefox 扩展（已下架）：https://chrome-stats.com/d/web-midi-api
