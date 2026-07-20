# Ticket: useFilePicker composable 设计

**Type**: grilling (HITL)
**Status**: open
**Blocked by**: 04-web-branch-and-ci

## Question

Web 环境下无法使用 Tauri 的文件对话框，需要封装 `useFilePicker` composable 实现双环境适配：

1. **接口设计**：
   - Tauri 环境 → `tauriAPI.fileSystem.openFileDialog()` + `readFile()`
   - 浏览器环境 → `<input type="file" accept=".mid,.midi">` + FileReader API
2. **返回值统一**：两种方式返回相同的数据结构（文件名 + ArrayBuffer）
3. **拖拽支持**：Web 环境是否额外支持拖拽上传？如何与 composable 集成？
4. **MIDI 文件加载流程**：现有 WaterfallPiano 的 MidiFileSection 如何调用？
5. **保存文件**：Web 环境下如何实现 "保存"？（下载链接 vs `showSaveFilePicker` API）
6. **录音导出**：Recorder 生成的音频/MIDI 数据在 Web 环境下如何导出？

需要通过 grilling 确定接口签名和实现策略。
