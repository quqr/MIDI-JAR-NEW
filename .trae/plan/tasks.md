# Tasks

## Task 1: PianoKeyboard 子组件增加点击事件

- [x] 1.1: `WhiteNote.vue` — 为白键 `<rect>` 添加 `@click` emit，携带 `midi` prop 值
- [x] 1.2: `BlackNote.vue` — 为黑键 `<rect>` 添加 `@click` emit，携带 `midi` prop 值
- [x] 1.3: `Labels.vue` — 标签层添加 `pointer-events-none` 避免拦截点击

## Task 2: PianoKeyboard 主组件增加 clickable 支持

- [x] 2.1: 添加 `clickable?: boolean` prop（默认 `false`）
- [x] 2.2: 添加 `noteClick` emit（`midi: number`）
- [x] 2.3: 透传 `clickable` 到 WhiteNote/BlackNote，当 `clickable=true` 时添加 `cursor-pointer` 样式
- [x] 2.4: 收集子组件的 `@click` 事件，转发为 `noteClick` emit

## Task 3: ChordDetail 集成交互逻辑

- [x] 3.1: 添加 `selectedMidis: ref<number[]>([])` 状态
- [x] 3.2: 实现 `onNoteClick(midi)` — toggle 逻辑（选中/取消选中）
- [x] 3.3: 实现 `clearSelected()` — 清空 `selectedMidis`
- [x] 3.4: 实现 `detectChord()` — 当 `selectedMidis.length >= 2` 时用 `Chord.detect()` 检测，检测到则导航到对应和弦 URL
- [x] 3.5: 实现 `detectedChordName: ref<string | null>(null)` — 存储检测结果名（用于"未识别"提示判断）
- [x] 3.6: `watch(chord)` — 当和弦变化时自动清空 `selectedMidis`
- [x] 3.7: 合并 `played` 计算属性 — 将原有 `played`（来自 chord）与 `selectedMidis` 合并传递给 PianoKeyboard

## Task 4: ChordDetail 模板更新

- [x] 4.1: 钢琴区域上方新增工具栏行：清除按钮（`btn btn-ghost btn-xs`）
- [x] 4.2: 钢琴区域上方新增提示区域：使用 `alert alert-info alert-soft`（单音）和 `alert alert-warning alert-soft`（未识别）
- [x] 4.3: PianoKeyboard 绑定 `:clickable="true"` 和 `@note-click="onNoteClick"`
- [x] 4.4: 清除按钮仅在 `selectedMidis.length > 0` 时显示
- [x] 4.5: 单音提示仅在 `selectedMidis.length === 1` 时显示
- [x] 4.6: 未识别提示仅在 `selectedMidis.length >= 2 && !detectedChordName` 时显示

## Task 5: i18n 翻译

- [x] 5.1: `zh.json` 添加 `chordDictionary.clearSelected`、`chordDictionary.unrecognizedChord`、`chordDictionary.singleNoteHint`
- [x] 5.2: `en.json` 添加对应英文翻译

## Task 6: 验证

- [x] 6.1: 构建通过（ChordDetail 无 TS 错误，其余为项目已有错误）
- [ ] 6.2: 点击琴键能正确高亮/取消高亮（需运行时验证）
- [ ] 6.3: 选中 2+ 音符后正确检测和弦并导航（需运行时验证）
- [ ] 6.4: 单音时显示 `alert alert-info alert-soft` 提示（需运行时验证）
- [ ] 6.5: 无法识别时显示 `alert alert-warning alert-soft` 提示（需运行时验证）
- [ ] 6.6: 清除按钮功能正常（需运行时验证）
- [ ] 6.7: 切换和弦时自动清除选中（需运行时验证）

# Task Dependencies

- [Task 2] 依赖 [Task 1]（子组件先支持点击，主组件才能透传）✅
- [Task 3] 依赖 [Task 2]（ChordDetail 需要 PianoKeyboard 的 clickable 功能）✅
- [Task 4] 依赖 [Task 3]（模板绑定需要交互逻辑就绪）✅
- [Task 5] 与 [Task 1-4] 可并行 ✅
- [Task 6] 依赖 [Task 1-5] 全部完成 ✅
