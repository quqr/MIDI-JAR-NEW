# MIDI-JAR 新增功能实施计划

> 生成日期：2026-08-21
> 范围：在现有架构上新增 8 项功能。**已排除「电脑键盘演奏（#2 QWERTY→MIDI）」**。
> 现状基线：Vue3 + Tauri2 + tonal（`Chord.detect`/`Scale`）+ Sampler/VST3（`vst3-host`）+ Waterfall/PixiJS + 自研 WebGL 流体引擎 + 路由图（@vue-flow）+ 记谱（VexFlow）+ 和弦字典。
> 约束（来自 `CONTEXT.md`）：禁止自定义 CSS（仅渲染层 / `CustomCursor` anime.js / Tauri `-webkit-app-region` 例外）；控件只用 daisyUI + Tailwind 工具类；禁用 Vue `<Transition>`；动画仅 `CustomCursor` 的 anime.js。

---

## 0. 工程纪律与验收标准

- **TDD 垂直切片**：一次一个测试（红）→ 最小实现（绿）→ 重构；禁止水平切片（先写全部实现再补测试）。
- **测试栈**：Vitest（已有 `npm test`、`npm run test:coverage`）。核心纯逻辑（调度、侦测、导出、解析、和弦/音阶生成）分支覆盖率 ≥ 90%。
- **验收硬性**：改动后以下三者全绿、零错误零警告：
  - `npm run type-check`（`vue-tsc --noEmit`）
  - `npm run lint`（`oxlint`）
  - `npm run build:pre`（`vue-tsc` + `vite build`）
- **不删除任何现有文件**；新增文件放入对应模块目录；`src/locales/zh.json` 与 `en.json` 同步。
- **命名/结构**：沿用现有范式（视图放 `src/views/<Module>/`，composable 放 `src/composables/`，设置项进 `stores/settings.ts`）。

---

## 1. 分阶段实施顺序

| 阶段                                     | 功能                                        | 理由                                                 |
| ---------------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| **Phase A**（低风险、高复用、快速见效）  | #1 节拍器、#9 演出浮窗、#4 音阶词典         | 复用现有调度/窗口/字典范式，工作量低，立刻提升可用性 |
| **Phase B**（形成「学→练→存→交付」闭环） | #3 MIDI 导出、#5 和弦进行/歌单、#6 练习模式 | 把已有能力串成产品闭环                               |
| **Phase C**（高投入、高上限）            | #7 MIDI→和弦分析、#8 VST 参数自动化         | 涉及分析精度与 Rust 侧改动                           |

---

## 2. 各功能详细计划

### #1 节拍器 Metronome

| 项       | 内容                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目标     | 稳定节拍基准：BPM、拍号、重拍强调、可视脉冲、tap tempo                                                                                                                                                   |
| 新增文件 | `src/views/Metronome/Metronome.vue`；`src/composables/useMetronome.ts`；可选 `src/views/Metronome/MetronomeSettings.vue`                                                                                 |
| 修改文件 | `src/router/index.ts`（加 `/metronome`）、`src/views/Home.vue`（加 `ModuleCard`）、`src/stores/settings.ts`（加 `metronome`）、`src/locales/{zh,en}.json`（加 `nav.metronome` / `settings.metronome.*`） |
| 复用     | `src/views/WaterfallPiano/audio/EventScheduler.ts`、`PerfClock.ts`（精确调度，勿引 `Tone.Transport`）；`useSamplerService` 触发 click 音                                                                 |
| 测试点   | `useMetronome`：BPM→间隔换算、拍号重拍判定、start/stop 清场；调度与 `EventScheduler` 集成                                                                                                                |
| 工作量   | 低                                                                                                                                                                                                       |

### #3 MIDI 文件导出（录制 → .mid）

| 项       | 内容                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目标     | 录制演奏/路由事件，导出标准 `.mid`（可回其它 DAW）                                                                                                                  |
| 新增文件 | `src/services/midi/MidiFileWriter.ts`（封装 `@tonejs/midi` 写出）；`src/views/WaterfallPiano/components/ExportMidiButton.vue`（或全局浮层）                         |
| 修改文件 | `src/views/WaterfallPiano/audio/Recorder.ts`（标准化事件为 `{tick,note,velocity,duration,channel}`）；`src/views/WaterfallPiano/WaterfallPiano.vue`（接入导出入口） |
| 复用     | `Recorder.ts` 雏形；`@tonejs/midi`（已装，仅用于读，现补写）；`@tauri-apps/plugin-dialog` + `plugin-fs`（已装）落盘，Web 端降级 `Blob` 下载                         |
| 测试点   | `MidiFileWriter`：事件→Midi→字节往返一致；多通道合并；tick 量化                                                                                                     |
| 工作量   | 低–中                                                                                                                                                               |

### #4 音阶词典 Scale Dictionary

| 项       | 内容                                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目标     | 与和弦字典对称的可参考/可播放音阶百科（组成音、音程、指法、试听）                                                                                                    |
| 新增文件 | `src/views/ScaleDictionary/ScaleDictionary.vue`、`ScaleOverview.vue`、`Detail/ScaleDetail.vue`、`Detail/components/ScaleIntervalsTable.vue`、`ScaleNotesDisplay.vue` |
| 修改文件 | `src/router/index.ts`（加 `/scale-dictionary`）、`src/views/Home.vue`、`src/locales/{zh,en}.json`                                                                    |
| 复用     | `tonal` 的 `Scale`/`ScaleType`（已装）；`useScalePlayer.ts`（播放）；`PianoKeyboard` 组件（可视化）；和弦字典整套视图范式                                            |
| 测试点   | 音阶数据生成（音名/音程正确）；详情渲染；与 `useScalePlayer` 衔接                                                                                                    |
| 工作量   | 中（复制和弦字典范式 + 换数据源，结构风险低）                                                                                                                        |

### #5 和弦进行 / 歌单（Setlist）

| 项       | 内容                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 目标     | 多和弦模块串成进行，循环/按拍切换，存为歌单，现场跳曲                                                                                           |
| 新增文件 | `src/stores/progressions.ts`；`src/views/ChordDisplay/ProgressionPlayer.vue`；`src/views/Settings/ChordDisplaySettings/ProgressionSettings.vue` |
| 修改文件 | `src/stores/settings.ts`（注册 progressions）、`src/views/ChordDisplay/ChordDisplay.vue`（高亮当前和弦）、`src/locales/{zh,en}.json`            |
| 复用     | 现有 `settings.chordDisplay` 数据结构；`EventScheduler`/`PerfClock`（定时切换）；`ChordDisplay` 渲染                                            |
| 测试点   | 进行调度（按小节切换 index）；与 `ChordDisplay` 联动；持久化（store 序列化）                                                                    |
| 工作量   | 中                                                                                                                                              |

### #6 视唱练耳 / 练习模式

| 项       | 内容                                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目标     | 随机播和弦/音程，用户听辨作答，实时判分、统计、渐进难度                                                                                            |
| 新增文件 | `src/views/Practice/Practice.vue`、`PracticeSettings.vue`；`src/composables/useEarTrainer.ts`                                                      |
| 修改文件 | `src/router/index.ts`、`src/views/Home.vue`、`src/stores/settings.ts`、`src/locales/{zh,en}.json`                                                  |
| 复用     | `ChordDictionary` 数据 / `tonal`（出题）；`useSamplerService`（发声）；`useChordDetection`/`Chord.detect`（标准答案判定）；`PianoKeyboard`（作答） |
| 测试点   | `useEarTrainer`：出题分布、判答逻辑、计分；与侦测一致性                                                                                            |
| 工作量   | 中（纯前端，风险低）                                                                                                                               |

### #7 MIDI 文件 → 和弦进行分析（时间线）

| 项       | 内容                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 目标     | 载入 MIDI 曲，按时间窗分部和声，输出可点击的和弦时间线                                                                  |
| 新增文件 | `src/services/analysis/ChordTimelineAnalyzer.ts`；`src/views/WaterfallPiano/components/ChordTimeline.vue`（或独立面板） |
| 修改文件 | `src/views/WaterfallPiano/midi/MidiFilePlayer.ts`（暴露分窗事件流）；`src/views/WaterfallPiano/WaterfallPiano.vue`      |
| 复用     | `MidiFilePlayer` 事件流；`helpers/chord-detect.ts`（`Chord.detect` 封装）；`ChordDictionary` 详情展示；现有时间轴控件   |
| 测试点   | `ChordTimelineAnalyzer`：分窗边界、转位/省略音判定、时间轴映射                                                          |
| 工作量   | 中–高（难点在分窗边界与判定精度，先出可用版再迭代）                                                                     |

### #8 VST 参数自动化 / 多插件链

| 项       | 内容                                                                                                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目标     | 多个 VST 串联成链；按时间曲线自动改参数（CC 自动化）                                                                                                                                                       |
| 新增文件 | `src/views/Sampler/components/PluginChainPanel.vue`、`AutomationEditor.vue`；`src/stores/vstAutomation.ts`                                                                                                 |
| 修改文件 | `src-tauri/src/vst/vst.rs`（单实例→`Vec<VstInstance>` 串行链 + `automate_param` 命令）、`src-tauri/src/lib.rs`（注册命令）、`src-tauri/capabilities/default.json`（权限）、`src/views/Sampler/Sampler.vue` |
| 复用     | `vst3-host` 依赖；现有 VST 加载命令；`Sampler` UI；设置体系                                                                                                                                                |
| 测试点   | Rust 侧：链处理顺序、参数推送批处理；前端：自动化曲线编辑与回放对齐时钟                                                                                                                                    |
| 工作量   | 高（Rust 改动 + 曲线编辑器，9 项最重）                                                                                                                                                                     |

### #9 演出浮窗 / 多窗口（always-on-top）

| 项       | 内容                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目标     | 把模块抽成独立小窗，置顶、可拖动、低占用                                                                                                                                                          |
| 新增文件 | `src-tauri/src/windows.rs`（或并入 `lib.rs`）；`src/composables/useFloatingWindow.ts`                                                                                                             |
| 修改文件 | `src-tauri/src/lib.rs`（注册 `open_floating_window` 命令、`setAlwaysOnTop`）、`src-tauri/capabilities/default.json`、`src/views/Layout/AppNavbar.vue` 或 `SettingsDrawer`（加「新窗口打开」入口） |
| 复用     | Tauri 窗口能力；现有路由（同一套 Vue 视图直接复用）；Tauri 事件（`emit`/`listen`）做窗口间状态同步                                                                                                |
| 测试点   | 窗口创建/置顶；路由透传；轻量事件同步                                                                                                                                                             |
| 工作量   | 低                                                                                                                                                                                                |

---

## 3. 跨功能依赖与复用总览

- **调度内核**：`EventScheduler` / `PerfClock` → 服务 #1 节拍器、#5 进行、#6 节奏训练、#7 分析时钟。
- **发声内核**：`useSamplerService` → 服务 #1、#4、#6。
- **乐理内核**：`tonal`（`Chord.detect`/`Scale`）+ `helpers/chord-detect.ts` → 服务 #4、#6、#7。
- **录制/文件**：`Recorder` / `MidiFilePlayer` / `@tonejs/midi` → 服务 #3、#7。
- **Tauri 命令通道**：服务 #3（fs/dialog）、#8（vst）、#9（window）。

## 4. 风险与开放问题

1. **#8 最重**：Rust 改动需重新 `tauri build`，且高频参数推送要批处理/节流，避免阻塞主线程。
2. **#7 判定精度**：转位、省略音、非三度叠置和弦会误判，建议先支持标准三和弦/七和弦，再迭代。
3. **#9 多窗口状态**：优先用 Tauri 事件而非共享重状态，避免复杂度。
4. **locale 同步**：每加一个功能必须同步 `zh.json` / `en.json`，否则 `i18n.t` 缺键。
5. **约束合规**：所有 UI 必须走 daisyUI/Tailwind，新增浮层不得引入 `<style>`/`<Transition>`（见 `CONTEXT.md`）。

## 5. 建议下一步

从 **Phase A** 起步，优先 **#1 节拍器**（复用度最高、风险最低）。进入 plan 模式后，对 #1 给出文件级改动清单 + Vitest 测试点，按 TDD 垂直切片实施。
