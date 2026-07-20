# Wayfinder: GitHub Pages 迁移 — 决策规格书

## Destination

产出一份可执行的迁移规格书（ADR + 任务分解），将 MIDI-JAR 项目部署到 GitHub Pages，采用双版本并行策略（保留 Tauri 桌面版 + 发布 Web 精简版），交给开发者直接实施。

## Notes

- 项目已有双模式设计：`isTauri()` / `runInTauri()` 已在 30+ 处使用
- Vite 配置中 `base: "./"` 已支持相对路径部署
- 核心冲突：Tauri 专有功能 vs Web 标准能力
- 技能：/grilling, /domain-modeling, /research, /prototype
- 先期可行性分析：`docs/github-pages-migration-feasibility.md`（结论：可行）
- 本 map 是对先期分析的验证和锐化

## Decisions so far

<!-- 已关闭 ticket 的索引 — 每行一个，含链接和一行摘要 -->

- [01-jzz-polyfill-research](file:///f:/Codes/MIDI-JAR-NEW/docs/wayfinder/tickets/01-jzz-polyfill-research.md) — JZZ 不是真正的硬件 polyfill；直接使用原生 Web MIDI API

1. **迁移方案**: 双版本并行（保留 Tauri 桌面版 + 发布 Web 精简版）
2. **代码管理**: 独立 `web` 分支
3. **部署触发**: push 到 web 分支自动触发 GitHub Actions
4. **路由模式**: `createWebHashHistory()`（兼容静态托管）
5. **MIDI 库选择**: ~~JZZ 库~~ → **原生 Web MIDI API + 轻量封装**（research 01 修正：JZZ 不是真正 polyfill，87%+ 浏览器已原生支持）
6. **MIDI 路由引擎**: Web 环境完全移除（路由 UI、wires、@vue-flow 拓扑图）
7. **Widget 窗口系统**: Web 环境完全移除
8. **窗口控件**: `v-if="isTauri()"` 条件隐藏（最小化/最大化/关闭/置顶/拖拽）
9. **窗口状态管理**: Web 环境移除 `windowState` store 及关联 UI
10. **文件持久化**: 统一 `localStorage`
11. **Settings Routing 页面**: Web 环境隐藏菜单项，路由定义保留
12. **构建体积**: 保持现有 `manualChunks`，上线后 Lighthouse 评估
13. **GitHub Pages 路径**: 构建时 `--base=/MIDI-JAR-NEW/`
14. **AudioContext**: 懒启动（用户首次触发 MIDI 操作时调用 `Tone.start()`）
15. **浏览器兼容性**: 原生 Web MIDI API + 不支持浏览器显示兼容性提示 banner（research 01 修正：JZZ polyfill 无法真正实现硬件访问）
16. **IMidiBackend 接口**: 需重新设计

## Not yet specified

- Web 环境下 MIDI 文件加载的完整 UX 流程（File API + 拖拽 + 示例文件）
- Web 环境下 Settings 面板哪些 section 需要条件隐藏
- Web 版测试策略（vitest 配置、E2E、浏览器兼容性测试）
- 录音功能在 Web 环境下的可行性（依赖 Tauri 文件写入）
- Web 版首次加载性能优化策略（code splitting 是否足够、是否需要 SSR）

## Out of scope

- Tauri 桌面版的任何修改（双版本并行，桌面版不受影响）
- 重写 Rust 后端为 Web 服务
- PWA/Service Worker 离线支持
- 多语言 SEO / SSR
