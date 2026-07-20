# Ticket: AudioContext 懒启动策略设计

**Type**: prototype (HITL)
**Status**: open
**Blocked by**: (none)

## Question

浏览器要求用户手势后才能启动 AudioContext（`Tone.start()`），否则 Tone.js 无法发声。选择懒启动而非启动遮罩，需要设计具体实现：

1. **触发时机**：哪个用户操作触发 `Tone.start()`？选项：
   - 首次点击任何按钮
   - 首次点击播放按钮
   - 首次交互 MIDI 键盘
   - 首次加载 MIDI 文件
2. **状态管理**：如何追踪 AudioContext 是否已启动？Pinia store vs composable vs 全局变量？
3. **用户反馈**：启动前是否需要视觉提示（如播放按钮灰色/播放按钮 tooltip "点击以启用音频"）？
4. **错误处理**：`Tone.start()` 失败时的处理
5. **与 Tauri 版的差异**：Tauri 版是否也需要此逻辑？还是仅在 Web 环境需要？

做一个最小原型来验证体验。
