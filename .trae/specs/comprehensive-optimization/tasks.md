# Tasks

- [x] Task 1: 类型系统统一 —— 合并 `src/types/settings.ts` 和 `src/types/index.ts` 中的重复类型定义
  - [x] 1.1 将 `src/types/index.ts` 中 Settings 相关类型（KeyboardSettings、ChordDisplaySettings 等及其 default 值）全部移除，改为 `export * from "./settings"`
  - [x] 1.2 将 `midiRoutes: MidiRoute[]` 字段补入 `src/types/settings.ts` 的 `Settings` 类型
  - [x] 1.3 验证 `vue-tsc --noEmit` 类型检查通过，确保所有导入路径仍正确

- [x] Task 2: Tauri API 类型安全封装 —— 消除 `window.tauriAPI` 全局污染
  - [x] 2.1 在 `src/utils/tauri.ts` 中为 `tauriAPI` 对象定义完整的 TypeScript 接口类型
  - [x] 2.2 移除 `(window as any).tauriAPI = tauriAPI` 全局挂载，改为模块 `export`
  - [x] 2.3 为所有 API 方法添加包装，在非 Tauri 环境下返回安全的 fallback 而非崩溃
  - [x] 2.4 更新 `src/stores/midiRouting.ts` 和其他直接引用 `window.tauriAPI` 的文件，改为 import 方式

- [x] Task 3: 生产环境日志清理 —— 移除调试日志残留
  - [x] 3.1 移除 `src/utils/tauri.ts` 中所有 `console.log("[MIDI_DEBUG] ...")` 语句
  - [x] 3.2 将关键的调试信息改为 `logger.debug()` 调用（开发环境可见，生产可关闭）

- [x] Task 4: 设置 Store 优化 —— 修复不必要的 Promise 包装 + 添加防抖保存
  - [x] 4.1 将 `updateSetting`、`updateSettings`、`resetSetting` 的返回类型从 `Promise<void>` 改为 `void`，移除 `return Promise.resolve()`
  - [x] 4.2 在 `watch` 的 `saveSettings` 调用上应用 500ms 防抖，使用已有的 `debounce` 工具函数
  - [x] 4.3 更新所有调用这些方法的代码，移除不必要的 `await`

- [x] Task 5: 移除 Utils 类过度设计 —— 简化 `src/helpers/utils.ts`
  - [x] 5.1 将 `getCurrentLocale` 从 Utils 静态类中移出为独立导出函数
  - [x] 5.2 更新 `src/helpers/index.ts` 的导出方式
  - [x] 5.3 检查并更新所有 `Utils.getCurrentLocale()` 引用为直接函数调用

- [x] Task 6: Tailwind CSS v4 配置迁移
  - [x] 6.1 删除 `tailwind.config.js` 文件（v4 不再自动读取）
  - [x] 6.2 检查 `src/styles/tailwind.css` 是否需要补充 `@theme` 配置（当前仅使用 DaisyUI，可能无需额外配置）
  - [x] 6.3 确认 `npm run dev` 启动无 Tailwind 相关警告

- [x] Task 7: 事件总线引入 —— 替代 `globalProperties.$emit`
  - [x] 7.1 安装 `mitt` 依赖
  - [x] 7.2 创建 `src/utils/eventBus.ts`，导出 mitt 实例及类型化事件定义
  - [x] 7.3 将 `src/main.ts` 中 widget 恢复逻辑迁移至专用 composable `useWidgetRecovery.ts`
  - [x] 7.4 将 `globalProperties.$emit` 的调用点替换为 mitt 事件，更新 `src/App.vue` 中的 `$on` 监听

- [x] Task 8: user-select 修复 —— 限定范围避免影响输入框
  - [x] 8.1 修改 `src/styles/tailwind.css`，将 `user-select: none` 从 `body` 移至 `.app-shell` 类或类似的容器级选择器
  - [x] 8.2 在 `input`、`textarea`、`[contenteditable]` 上显式设置 `user-select: text`
  - [x] 8.3 验证设置页面文本输入框可正常选择文本

- [x] Task 9: ARIA 无障碍增强
  - [x] 9.1 为 `NavButton.vue` 添加 `aria-label` prop 并绑定到根元素
  - [x] 9.2 检查 AppNavbar 中各 NavButton 使用点，传入对应的 i18n 标签文本
  - [x] 9.3 为 PianoKeyboard 交互区域添加键盘可访问性和 `role` 属性

- [x] Task 10: MIDI 路由加载状态与错误反馈
  - [x] 10.1 在 `useMidiRoutingStore` 中添加 `loading` 和 `error` 状态 ref
  - [x] 10.2 在 `Routing.vue` 视图中根据 `loading` 和 `error` 状态渲染相应的加载指示器和错误提示 UI
  - [x] 10.3 错误提示 UI 包含"重试"按钮，点击后重新调用 `initialize()`

- [x] Task 11: 和弦数据懒加载
  - [x] 11.1 将 `src/helpers/chords-data.ts` 转换为懒加载 + 类型约束模式
  - [x] 11.2 更新 `src/helpers/chord-detect.ts` 和所有引用处，改为按需加载（首次调用时加载并缓存）
  - [x] 11.3 对和弦数据条目添加类型约束（使用 tuple 类型替代 `string[][]`）

- [x] Task 12: 单元测试基础设施
  - [x] 12.1 创建 `src/__tests__/` 目录和 vitest 配置文件
  - [x] 12.2 为 `mergeDeep` 编写测试用例（覆盖基本合并、嵌套合并、数组覆盖）
  - [x] 12.3 为 `setValueByPath` 编写测试用例（覆盖点号路径、深层嵌套、边界情况）
  - [x] 12.4 为和弦检测核心逻辑编写测试用例（覆盖基本三和弦、七和弦、转位识别）
  - [x] 12.5 运行 `npx vitest run` 确认全部用例通过

# Task Dependencies
- Task 2 依赖 Task 1（类型统一后 Tauri API 类型定义更清晰）
- Task 7 依赖 Task 2（事件总线中的 Tauri 事件也需要类型安全封装）
- Task 12 可与 Task 1-11 并行开发
- Task 3、4、5、6、8、9、10、11 之间无相互依赖，可并行