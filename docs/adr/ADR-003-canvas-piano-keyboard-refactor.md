# ADR-003: CanvasPianoKeyboard 组件重构

## Status

Accepted

## Context

`src/components/CanvasPianoKeyboard/CanvasPianoKeyboard.vue` 是一个基于 `KeyboardRenderer`（`src/views/WaterfallPiano/engine/KeyboardRenderer.ts`）的 Canvas 钢琴键盘组件，被 `ChordDisplay`、`Sampler`、`ChordDetail`、`ChordInversions` 等多个视图复用。审查（grill）发现这不是「风格问题」，而是存在**功能性 bug + 大量死代码**：

1. **键盘范围被硬编码忽略（功能性 bug，最严重）**。原 `toWaterfallSettings` 写死 `range: "61" as const`，而 `customFrom/customTo` 虽已传入 `kb.from/kb.to`。但 `KeyboardRenderer.applyRangeFromSettings()` 只在 `range === "custom"` 时才读取 custom 值，否则走 61 键预设（MIDI 36–96）。结果：所有消费方传入的 `:keyboard="{ from, to }"` **完全不生效**，ChordDisplay / ChordDetail 期望的自定义音区形同虚设，永远渲染同一段 61 键。
2. **`chord` prop 是空壳**。3 个消费方（`ChordDisplay` / `ChordDetail` / `ChordInversions`）都传了 `:chord`（tonaljs `Chord`，`notes` 为音级如 `["C","E","G"]`），但组件原实现只有一句「暂时不处理，使用 targets 代替」——和弦音从未被高亮。ChordDisplay 本指望它高亮当前和弦形状，实际什么都没发生。
3. **100 行 `toWaterfallSettings` 是死数据**。手写完整 `WaterfallPianoSettings`（particles / background / sound / aura / midiFile 等），但 `KeyboardRenderer` 只读取 `settings.keyboard` 段，其余 90% 喂进去从不读取；且 `WaterfallPianoSettings` 类型一变这里就得跟着改，纯维护负担。
4. **死 prop**：`keySignature`（组件内从未使用，仅 `ChordDisplay` 传）、`exactTargets`（无任何消费方传）。
5. **死状态 `animationStates`**：记录 pressTime / releaseTime，`render()` 从不读取——所谓「按下动画 / 淡出」从未实现，`fadeOutDuration` 也是空话。
6. **渲染器内 `highlights` 私有集合**：`render()` 从不读取，纯冗余（对外暴露的 `clearHighlight` / `clearAllHighlights` 仍被单测依赖，保留）。
7. **lossy 标签映射**：`label` 的 `chordNote` / `interval` 值被静默丢弃；`sizes.height/ratio/bevel` 被静默忽略，且无任何注释说明。

## Decision

1. **修复范围 bug**：`toKeyboardConfig()` 改为 `range: "custom"` 并透传 `customFrom: kb.from` / `customTo: kb.to`，使 `KeyboardRenderer.applyRangeFromSettings()` 真正按用户音名范围生效。
2. **用 `toKeyboardConfig()` 替换 100 行 `toWaterfallSettings`**：只构建渲染器真正关心的 `keyboard` 段，其余段直接复用共享常量 `defaultWaterfallSettings`（`toRendererSettings()` = `{ ...defaultWaterfallSettings, keyboard: toKeyboardConfig(kb) }`）。删除与无关类型（`WaterfallPianoSettings` 的 particles/background/sound 等）的强耦合。
3. **实现 `chord` 高亮**：新增 `chordNotesToMidi(chord, from, to)`，把和弦音级映射到可见范围内的 MIDI（八度不明时取 `[from,to]` 内每个音级的第一个匹配，保证和弦形状在屏上可见），在 `updateHighlights()` 中与 `played` / `sustained` / `targets` / `midi` 一并高亮。
4. **删除死代码**：移除 `keySignature` / `exactTargets` 两个 prop，移除组件内 `animationStates` 状态；删除渲染器 `highlights` 私有字段及其两处写入点（保留 `clearHighlight` / `clearAllHighlights` 公开方法）。`ChordDisplay.vue` 同步移除已删的 `:keySignature` 绑定。
5. **显式标注 lossy 映射**：在 `toKeyboardConfig()` 的 JSDoc 中明确列出 `KeyboardSettings` 中哪些字段被有意丢弃（`skin` / `keyInfo` / `wrap` / `displaySustained` / `fadeOutDuration` / `textOpacity` / `sizes.height/ratio/bevel` / `colors.sustained/wrapped`），不再静默忽略。
6. **指针交互健壮性**：改用 `setPointerCapture(e.pointerId)` + `clientX - rect.left` 坐标（替代 `offsetX`，避免边框 / transform 偏移）；`releasePointerCapture` 前用 `hasPointerCapture()` 守卫，避免 `pointerleave` 与 `pointerup` 二次释放抛 `InvalidPointerId`；重绘统一走 `scheduleRender()`（rAF 去抖）。

### 结构示意

```
重构前（toWaterfallSettings）：               重构后（toKeyboardConfig）：
┌─ WaterfallPianoSettings ─────────┐        ┌─ toRendererSettings() ──────────┐
│  particles / background / sound  │        │  ...defaultWaterfallSettings     │
│  / aura / midiFile …（90% 死数据）│   ──▶  │  keyboard: toKeyboardConfig(kb)  │
│  keyboard: {                      │        │     range:"custom"              │
│    range:"61"  ← bug：忽略from/to │        │     customFrom/to  ← 真正生效   │
│    customFrom/to（被忽略）         │        │     keyLabel/showNoteNames …    │
│    …（大段手写）                   │        └────────────────────────────────┘
└──────────────────────────────────┘
```

## Consequences

- **功能性修复**：`keyboard.from/to` 现在真正控制可见音区；`chord` 现在能高亮和弦形状。
- **代码量下降**：组件从约 280 行降到约 275 行，但删除了 100 行巨型死对象与若干死状态；更重要的是消除了与 `WaterfallPianoSettings` 无关段的类型耦合。
- **可验证**：`vue-tsc --noEmit` 类型检查 **0 错误**；`KeyboardRenderer.test.ts` 单测 **13/13 通过**（删除 `highlights` 字段后未破坏测试）。
- **向后兼容**：props 接口精简（删 `keySignature` / `exactTargets`），消费方无依赖此二字段者；`chord` 由「空壳」变为「生效」，属增强而非破坏性变更。
- **文档化**：本 ADR + `docs/glossary-canvas-piano-keyboard.md` 沉淀了重构决策与领域术语。

## 刻意未改（受 `KeyboardRenderer` 能力限制，非本次范围）

- **分类高亮未实现**：`played` / `sustained` / `targets` 当前共用同一高亮色（渲染器只有单一 `pressedKeyColor`），无法区分「已弹 / 持续 / 目标」。需渲染器扩展多色高亮 API 后方可支持。
- **淡出动画未实现**：`fadeOutDuration` / `animationStates` 概念已移除，因渲染器无动画循环，无法实现按下后淡出。
- **窄屏裁切**：`width < 768`（`NARROW_BREAKPOINT`）时 `resize()` 会强制收束到 `NARROW_RANGE`，可能裁掉和弦外圈音；属渲染器既有行为，本次未动。

## Alternatives Considered

- **只把 `range` 改成 `"custom"` 但保留 100 行 `toWaterfallSettings`**：被否决——死数据问题（决策 3）依然存在，且与 `WaterfallPianoSettings` 的耦合继续加重。
- **保留 `animationStates` 并实现完整淡出动画**：被否决（本次不做）——需渲染器引入动画循环，超出组件层重构范围；且 `fadeOutDuration` 默认值本就为 0。
- **给 `played` / `sustained` / `targets` 分配不同高亮色**：被否决（本次不做）——渲染器 `highlightNote` 仅支持单一 `pressedKeyColor`，单改组件无法区分，需先扩展渲染器。
- **保留 `keySignature` prop「留待将来用」**：被否决——没有任何消费方使用，且 `keySignature` 在调性可视化上的语义应由渲染器或上层明确后再加，空 prop 只会误导。
