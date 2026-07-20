# Ticket: 浏览器兼容性检测与降级策略

**Type**: grilling (HITL)
**Status**: open
**Blocked by**: (none) — 01 已解决，策略为原生 Web MIDI API + banner

## Question

根据 JZZ polyfill 研究结果，设计浏览器兼容性检测和降级策略：

1. **能力检测**：如何检测当前浏览器是否支持 Web MIDI API？（`'requestMIDIAccess' in navigator`）
2. **降级层次**：
   - 完整支持（Chrome/Edge + JZZ）：所有 MIDI 功能可用
   - 部分支持（JZZ polyfill 可用）：哪些功能可用？
   - 不支持（无 Web MIDI 无 polyfill）：仅纯软件功能（MIDI 文件播放、和弦词典）
3. **用户提示**：
   - 不支持时显示什么？Banner？弹窗？内联提示？
   - 提示内容："请使用 Chrome 或 Edge 以获得完整 MIDI 体验"？
   - 是否提供 "仍要继续" 选项？
4. **`useBrowserSupport` composable**：
   - `isMidiSupported: Ref<boolean>`
   - `supportLevel: Ref<'full' | 'partial' | 'none'>`
   - `showWarning: Ref<boolean>`
5. **与 JZZ 初始化的集成**：JZZ 初始化失败时如何 fallback？
