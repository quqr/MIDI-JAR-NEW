# MIDI-JAR

跨平台 MIDI 应⽤，⽀持 Tauri 和浏览器环境，提供钢琴键盘可视化、和弦检测、MIDI ⽂件播放和瀑布流演奏等功能。

## Language

**WaterfallPiano**:
瀑布钢琴页面，提供 MIDI ⽂件播放和实时 MIDI 输⼊的瀑布流可视化。
_Avoid_: waterfall view, waterfall display

**PlayerState**:
播放器状态枚举，包含七种状态：idle（空闲）、loading（加载中）、ready（就绪）、playing（播放中）、paused（已暂停）、recording（录制中）、error（错误）。
_Avoid_: playback state, player status

**NoteBlock**:
音符块，瀑布流视图中表示单个音符的可视化元素，包含位置、颜⾊和时⻓信息。
_Avoid_: note brick, note tile, piano block

**Mode**:
播放模式，分为 realtime（实时模式，响应 MIDI 输⼊）和 synthesia（瀑布流模式，播放 MIDI ⽂件）。
_Avoid_: play mode, display mode

**State Transition**:
状态转换，播放器状态之间的合法转换路径，遵循严格的状态机规则。
_Avoid_: state change, state switch

**Cleanup**:
清理机制，根据状态转换执⾏不同粒度的资源释放（视觉、⾳频、数据）。
_Avoid_: dispose, release, teardown

**AudioContext**:
Web Audio API 的⾳频上下⽂，管理所有⾳频资源的⽣命周期。
_Avoid_: audio engine, sound context

**MidiFilePlayer**:
MIDI ⽂件播放器，解析和播放 MIDI ⽂件，⽣成 NoteBlock 数据。
_Avoid_: midi player, file player

**VisibilityRefresh**:
窗⼝状态刷新机制，在窗⼝从最⼩化恢复时触发强制刷新。
_Avoid_: window refresh, visibility handler

## Subsystems

### State Management

状态管理子系统，实现七状态模型和状态转换规则：
- playing/paused 状态不能切换模式或加载新⽂件
- recording 状态不能播放或加载⽂件
- error 状态只能转换为 idle
- 状态转换⾃动触发相应的清理流程

### Rendering

渲染子系统，负责瀑布流可视化：
- BackgroundRenderer：背景渲染
- KeyboardRenderer：钢琴键盘渲染
- NoteBlockSystem：音符块系统
- NoteColorMapper：音符颜⾊映射

### Audio

⾳频⼦系统，管理⾳频资源和播放：
- SoundEngine：⾳频引擎
- Recorder：录制器

### MIDI

MIDI ⼦系统，处理 MIDI 输⼊输出：
- MidiFilePlayer：MIDI ⽂件播放器
- MidiDeviceManager：MIDI 设备管理器
- 实时 MIDI 输⼊处理

## Constraints

- **Cross-platform Compatibility**: 必须同时⽀持 Tauri 和浏览器环境
- **State Machine Enforcement**: 严格遵循七状态模型的转换规则
- **Resource Lifecycle**: 使⽤ RAII 模式管理资源，初始化失败触发完整清理
- **Logging**: 使⽤ Pino 库，开发环境 DEBUG 级别，⽣产环境 WARN 级别，仅输出到控制台
- **Visual Distinction**: 琴块边框必须完全移除，仅通过颜⾊和阴影区分