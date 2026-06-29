# Checklist

## 功能完整性

- [ ] PianoKeyboard 支持 `clickable` prop，开启后琴键可点击
- [ ] 点击琴键发出 `noteClick(midi)` 事件
- [ ] ChordDetail 维护 `selectedMidis` 状态，toggle 选中/取消
- [ ] 选中 2+ 音符后自动检测和弦并导航到对应详情页
- [ ] 单音时显示 `alert alert-info alert-soft` 提示："已选中 1 个音符，请继续选择"
- [ ] 无法识别时显示 `alert alert-warning alert-soft` 提示："未识别的和弦组合"
- [ ] "清除全部"按钮功能正常（仅在有选中时可见）
- [ ] 切换和弦时自动清除选中状态

## daisyUI 规范

- [ ] 使用 daisyUI 语义色（`info`、`warning`、`ghost`），不使用 Tailwind 原始色名
- [ ] 提示组件使用 `alert` + `alert-soft` 样式
- [ ] 清除按钮使用 `btn btn-ghost btn-xs`
- [ ] 不使用 `dark:` 前缀（daisyUI 主题自动切换）

## 代码质量

- [ ] 构建通过（`npm run build`）
- [ ] PianoKeyboard 默认模式（`clickable=false`）行为无变化
- [ ] 点击事件不与现有 MIDI 检测（useNotes）冲突
- [ ] i18n 中英文翻译完整
