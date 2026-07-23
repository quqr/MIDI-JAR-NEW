# 术语表：CanvasPianoKeyboard 键盘组件

> 配合 `src/components/CanvasPianoKeyboard/CanvasPianoKeyboard.vue` 与 `docs/adr/ADR-003-canvas-piano-keyboard-refactor.md` 使用。

## 核心概念

- **`CanvasPianoKeyboard`**：基于 Canvas 的钢琴键盘 Vue 组件。负责把「音符集合（played / sustained / targets / midi / chord）」渲染为高亮键，并处理点击 / 按住交互（`noteClick` / `noteOn` / `noteOff`）。底层绘制委托给 `KeyboardRenderer`。
- **`KeyboardRenderer`**：Canvas 钢琴键盘渲染器（位于 `src/views/WaterfallPiano/engine/`）。职责：在 Canvas 上绘制键体、管理 MIDI↔像素的双向映射（`xToMidi` / `getVisibleRange`）、维护高亮集合（`highlightNote` / `clearAllHighlights`）。被本组件与瀑布流 `WaterfallEngine` **共用**，故其公开签名不可随意改动。
- **`KeyboardSettings`**：组件对外 props 的键盘配置类型（来自 `@/types/settings`）。以**音名**描述范围与外观：`from` / `to`（如 `"C3"` / `"B5"`）、`label` / `keyName` / `keyInfo`、`colors`、`sizes`、`fadeOutDuration` 等。
- **`KeyboardConfig`**：`KeyboardRenderer` 实际消费的键盘配置类型（来自 `src/views/WaterfallPiano/types`）。以 `range` + `customFrom/customTo`（MIDI 或音名）、`keyLabel` / `showNoteNames` / `whiteKeyColor` 等字段描述。**组件通过 `toKeyboardConfig()` 把 `KeyboardSettings` 翻译为它。**
- **`WaterfallPianoSettings`**：瀑布流钢琴的完整设置类型（`src/views/WaterfallPiano/types`）。含 `keyboard` 段 + `particles` / `background` / `sound` / `aura` / `midiFile` 等段。`KeyboardRenderer` 只读取 `keyboard` 段，其余与本组件无关（重构前曾被手写填充为死数据，见 ADR-003 决策 2）。

## 范围与坐标

- **`range`**：键盘音区模式。取值为 `"61"` / `"88"` / `"custom"` 等预设。关键约束：`KeyboardRenderer.applyRangeFromSettings()` **仅在 `range === "custom"` 时**读取 `customFrom/customTo`；否则走对应键数预设。原代码写死 `"61"` 导致 `from/to` 被忽略（已修复）。
- **`customFrom` / `customTo`**：自定义音区端点，对应组件 props 的 `keyboard.from` / `keyboard.to`（音名）。仅在 `range:"custom"` 下生效。
- **`getVisibleRange()`**：`KeyboardRenderer` 返回的当前可见 MIDI 区间 `{ from, to }`。`chordNotesToMidi()` 用它界定和弦音的映射范围。
- **`xToMidi(x)`**：把 Canvas 内 x 像素坐标映射回 MIDI 音高（点击命中检测）。重构后传入 `clientX - rect.left`（相对 Canvas 左缘），避免 `offsetX` 在边框 / transform 下的偏移。

## 高亮与交互

- **`highlightNote(midi)` / `clearAllHighlights()` / `clearHighlight(midi)`**：`KeyboardRenderer` 的高亮 API。`clearAllHighlights` 先清空再整体重设，是组件 `updateHighlights()` 的标准用法（单测依赖这两个方法，故保留）。
- **`activeNotes`**：`KeyboardRenderer` 内部活跃音符集合（`render()` 据此绘制按下态）。重构后保留；原冗余的 `highlights` 私有集合已删除。
- **`chord`（tonaljs `Chord`）**：和弦对象，`notes` 为**音级数组**（如 `["C","E","G"]`），不带八度。组件通过 `chordNotesToMidi()` 把它映射到可见 MIDI 并高亮（八度不明时取 `[from,to]` 内每个音级的第一个匹配）。
- **`chordNotesToMidi(chord, from, to)`**：组件内新增函数，把和弦音级翻译为可见范围内的 MIDI 列表。
- **`midiToPitchClass(midi)`**：MIDI→音级（如 60 → `"C"`），来自 `src/views/WaterfallPiano/constants`，供 `chordNotesToMidi` 做音级匹配。
- **`clickable` / `sustainMode`**：交互开关。`clickable` 决定是否响应指针；`sustainMode=true` 时按下保持并 emit `noteOn`/`noteOff`（经 `pointerDownNotes` 追踪当前按住音），`false` 时点击即 emit `noteClick`。
- **`pointerDownNotes`**：`sustainMode` 下当前按住的 MIDI 集合；在 `updateHighlights()` 末尾重新高亮，防止 prop 变化被 `clearAllHighlights()` 抹掉。
- **`scheduleRender()` / `updateHighlights()`**：重绘调度。`scheduleRender()` 用 `requestAnimationFrame` 去抖（同一帧内多次触发只渲染一次）；`updateHighlights()` 负责清空并重新写入所有高亮后调用 `renderer.render()`。

## 映射与丢弃字段

- **`toKeyboardConfig(kb)`**：`KeyboardSettings` → `KeyboardConfig` 的翻译函数；只覆盖渲染器真正读取的字段。
- **`toRendererSettings(kb)`**：组装完整 `WaterfallPianoSettings`，其余段复用共享常量 `defaultWaterfallSettings`，仅 `keyboard` 段由 `toKeyboardConfig` 生成。
- **`DEFAULT_KEYBOARD`**：组件默认 `KeyboardSettings`（`skin:"classic"`、`from:"C3"`、`to:"B5"`、`label:"none"` 等），用共享常量避免每次实例重建大对象。
- **`defaultWaterfallSettings`**：`src/views/WaterfallPiano/constants` 中的瀑布流默认设置。组件复用其 `keyboard` 段作为兜底字段来源。
- **lossy（有意丢弃）字段**：以下 `KeyboardSettings` 字段在 Canvas 键盘渲染器中没有对应概念，属预期丢弃并在 `toKeyboardConfig()` 注释显式标注：`skin` / `keyInfo` / `wrap` / `displaySustained` / `fadeOutDuration` / `textOpacity` / `sizes.height` / `sizes.ratio` / `sizes.bevel` / `colors.sustained` / `colors.wrapped`（渲染器只有单一按下色 `pressedKeyColor`）。

## 已删除（历史包袱，见 ADR-003）

- **`keySignature` / `exactTargets`**：原组件死 prop——`keySignature` 组件内从未使用（仅 `ChordDisplay` 传），`exactTargets` 无任何消费方传。重构时删除。
- **`animationStates`**：原组件内死状态，记录 pressTime / releaseTime 但 `render()` 从不读取；所谓按下 / 淡出动画从未实现，已删除。
- **`highlights`（渲染器内）**：原 `KeyboardRenderer` 私有集合，`render()` 从不读取，已删除其字段与写入点（对外 `clearHighlight` / `clearAllHighlights` 保留）。
