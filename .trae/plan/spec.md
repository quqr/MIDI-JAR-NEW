# 交互式钢琴键盘 — 点击检测和弦 Spec

## Why

用户在和弦详情页只能被动查看已知和弦的钢琴展示，无法通过自由点击琴键来探索未知和弦组合。需要将 PianoKeyboard 从纯展示组件升级为可交互组件，让用户点击琴键选中音符，系统实时检测并显示对应的和弦信息。

## What Changes

- PianoKeyboard 及其子组件（WhiteNote/BlackNote/Labels）增加点击事件支持
- PianoKeyboard 新增 `clickable` prop 和 `noteClick` emit
- ChordDetail 集成点击交互逻辑：维护选中音符状态、和弦检测、结果导航
- 钢琴上方新增"清除全部"按钮和"未识别"提示
- 新增 i18n 翻译键

## Impact

- Affected code:
  - `src/components/PianoKeyboard/PianoKeyboard.vue` — 主组件
  - `src/components/PianoKeyboard/WhiteNote.vue` — 白键子组件
  - `src/components/PianoKeyboard/BlackNote.vue` — 黑键子组件
  - `src/components/PianoKeyboard/Labels.vue` — 标签子组件
  - `src/components/PianoKeyboard/ClassicBoard.vue` — 布局组件
  - `src/components/PianoKeyboard/FlatBoard.vue` — 布局组件
  - `src/views/ChordDictionary/Detail/ChordDetail.vue` — 详情页集成
  - `src/locales/zh.json` / `src/locales/en.json` — i18n

## ADDED Requirements

### Requirement: 琴键可点击

PianoKeyboard SHALL 支持通过 `clickable` prop 开启点击交互模式。当 `clickable=true` 时：

- 白键和黑键的 SVG `<rect>` 元素 SHALL 响应 `@click` 事件
- 点击 SHALL 发出 `noteClick(midi: number)` 事件
- 琴键 SHALL 显示 `cursor-pointer` 样式

#### Scenario: 默认模式不可点击

- **WHEN** `clickable` 未设置或为 `false`
- **THEN** 行为与当前完全一致，无任何交互变化

#### Scenario: 点击琴键

- **WHEN** `clickable=true` 且用户点击某个琴键
- **THEN** 组件发出 `noteClick` 事件，携带该琴键的 MIDI 编号

### Requirement: 用户选中音符高亮

ChordDetail SHALL 维护一个 `selectedMidis: number[]` 状态。当用户点击琴键时：

- 若该 MIDI 编号不在 `selectedMidis` 中 → 添加并高亮
- 若已在 `selectedMidis` 中 → 移除并取消高亮
- 选中的音符 SHALL 通过 `played` prop 传递给 PianoKeyboard 以高亮显示

#### Scenario: 选中音符

- **WHEN** 用户点击一个未选中的白键（MIDI 60 = C4）
- **THEN** `selectedMidis` 包含 `[60]`，C4 键高亮显示

#### Scenario: 取消选中

- **WHEN** 用户再次点击已选中的 C4 键
- **THEN** `selectedMidis` 为空，C4 键恢复默认样式

### Requirement: 实时和弦检测

当 `selectedMidis` 变化时，ChordDetail SHALL 使用 Tone.js `Chord.detect()` 检测选中音符组成的和弦。

#### Scenario: 检测到已知和弦

- **WHEN** 用户选中 `[60, 64, 67]`（C-E-G = C 大三和弦）
- **THEN** 系统导航到 C major 和弦详情页，URL 更新为 `/chord/C/major`
- **THEN** 详情区显示 C major 的完整信息（和弦名、键盘、音程、五线谱等）

#### Scenario: 无法识别

- **WHEN** 用户选中 `[60, 61]`（不构成已知和弦）
- **THEN** 详情区保持当前和弦信息不变
- **THEN** 钢琴上方显示 `alert alert-warning alert-soft` 提示："未识别的和弦组合"

#### Scenario: 单音

- **WHEN** 用户只选中 1 个音符
- **THEN** 不触发和弦检测，详情区保持不变，选中的音符高亮显示
- **THEN** 钢琴上方显示 `alert alert-info alert-soft` 提示："已选中 1 个音符，请继续选择"

### Requirement: 清除选中

ChordDetail SHALL 提供"清除全部"按钮，仅在 `selectedMidis.length > 0` 时可见。

#### Scenario: 点击清除按钮

- **WHEN** 用户点击"清除全部"按钮
- **THEN** `selectedMidis` 清空，所有琴键高亮取消，"未识别"提示消失

#### Scenario: 切换和弦时自动清除

- **WHEN** 用户通过侧栏或搜索切换到其他和弦
- **THEN** `selectedMidis` 自动清空

## MODIFIED Requirements

### Requirement: PianoKeyboard Props

新增 props：

- `clickable: boolean` — 是否启用点击交互（默认 `false`）

新增 emits：

- `noteClick(midi: number)` — 琴键被点击时触发

### Requirement: ChordDetail 模板

- 钢琴区域上方新增工具栏行：包含"清除全部"按钮（`btn btn-ghost btn-xs`）
- 钢琴区域上方新增提示区域：使用 `alert` 组件显示状态提示
- PianoKeyboard 组件增加 `:clickable="true"` 和 `@note-click="onNoteClick"`

## UI 组件选型（daisyUI）

| 元素         | 组件                                  | 理由                               |
| ------------ | ------------------------------------- | ---------------------------------- |
| 清除按钮     | `btn btn-ghost btn-xs`                | 轻量操作按钮，不抢视觉焦点         |
| 单音提示     | `alert alert-info alert-soft`         | 信息性提示，引导用户继续选择       |
| 未识别提示   | `alert alert-warning alert-soft`      | 警告提示，非错误，只是未匹配到和弦 |
| 选中音符高亮 | 复用 PianoKeyboard 现有 `played` 样式 | 与 MIDI 检测的高亮保持一致         |

### 色彩规范（daisyUI 语义色）

| 状态       | 色彩                                          | 说明                     |
| ---------- | --------------------------------------------- | ------------------------ |
| 选中的琴键 | `primary`（通过 PianoKeyboard `played` 状态） | 用户主动选择的音符       |
| 单音提示   | `info` / `info-content`（alert-soft）         | 引导性信息               |
| 未识别提示 | `warning` / `warning-content`（alert-soft）   | 非错误，只是未匹配到和弦 |
| 清除按钮   | `ghost` 样式                                  | 低调，不干扰主视觉       |
