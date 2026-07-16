# MIDI-JAR 领域上下文

## 项目概述

MIDI-JAR 是一个基于 Tauri + Vue 3 + TypeScript 的桌面音乐应用程序,提供 MIDI 设备管理、和弦字典、瀑布钢琴可视化等功能。

## 核心领域概念

### MIDI 设备管理

**MIDI 路由 (MidiRoute)**

- 定义 MIDI 输入设备到输出设备的映射关系
- 包含输入设备名称、输出设备名称、路由类型(physical/internal)、启用状态

**MIDI 线路 (MidiWire)**

- 表示一个已建立的 MIDI 连接
- 包含路由配置和连接状态
- 由 Rust 后端管理连接生命周期

**内部输出 (Internal Output)**

- 特殊的 MIDI 输出类型,指向应用内部模块
- 预定义模块: chord-dictionary, chord-display/default, debugger
- 通过 Tauri 事件系统分发 MIDI 消息

### 和弦字典 (Chord Dictionary)

**和弦 (Chord)**

- 音乐理论中的和弦实体
- 由根音(tonic)和和弦类型(type)组成
- 使用 @tonaljs 库进行音乐理论计算

**和弦别名 (Chord Alias)**

- 用户自定义的和弦名称映射
- 用于显示偏好(如: "Cmaj7" → "CM7")

**和弦分组 (Chord Grouping)**

- 按质量(quality)或音程(intervals)分组显示
- 支持在调性内筛选和弦

### 瀑布钢琴 (Waterfall Piano)

**音符块 (Note Block)**

- 瀑布流中下落的音符可视化单元
- 包含 MIDI 音符编号、开始/结束时间、颜色等信息
- 支持实时模式和播放模式

**流体模拟 (Fluid Simulation)**

- 基于 Navier-Stokes 方程的 WebGL 流体特效
- 由 MIDI 事件驱动产生视觉反馈
- 作为瀑布钢琴的背景层渲染

**音高映射 (Pitch Mapping)**

- MIDI 音符编号到视觉属性的映射
- 包括颜色、位置、键盘显示等

### 设置管理 (Settings)

**设置路径 (Setting Path)**

- 使用点分隔的路径标识设置项(如: "notation.key")
- 支持深层嵌套的对象结构
- 通过 `setValueByPath` 实现动态更新

**预设配置 (Preset)**

- 质量预设: low/medium/high
- 风格预设: gentle/standard/turbulent
- 用户语义映射到底层参数

## 架构层次

### 前端层 (Vue 3)

- **视图层 (Views)**: 页面级组件(ChordDictionary, WaterfallPiano, Settings)
- **组件层 (Components)**: 可复用的 UI 组件(Notation, PianoKeyboard, SettingsDrawer)
- **状态层 (Stores)**: Pinia store 管理 应用状态
- **组合式函数 (Composables)**: 封装可复用的响应式逻辑

### 引擎层 (TypeScript)

- **流体引擎 (Fluid Engine)**: WebGL 流体模拟系统
- **渲染引擎 (Renderer)**: Canvas 2D 绘制逻辑
- **音频引擎 (Audio Engine)**: Tone.js 音频合成

### 后端层 (Rust/Tauri)

- **MIDI 管理**: 底层 MIDI 设备连接和消息路由
- **文件系统**: 文件读写和监听
- **窗口管理**: 应用窗口生命周期

## 技术约束

1. **平台**: 桌面应用(Windows/macOS/Linux)
2. **实时性**: MIDI 消息处理需低延迟(< 5ms)
3. **性能**: 流体模拟保持 45fps+
4. **类型安全**: TypeScript strict mode
5. **测试**: 核心引擎单元测试覆盖

## 术语表

- **MIDI**: Musical Instrument Digital Interface,数字音乐接口标准
- **Tauri**: Rust 驱动的跨平台桌面应用框架
- **Pinia**: Vue 3 官方状态管理库
- **WebGL**: Web Graphics Library,浏览器 3D 图形 API
- **Navier-Stokes**: 流体力学方程
- **Composable**: Vue 3 组合式函数模式
