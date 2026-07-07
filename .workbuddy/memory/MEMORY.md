# MIDI-JAR-NEW 项目长期记忆

## 技术栈
- **前端**：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + DaisyUI v5
- **桌面**：Tauri（跨平台 Windows/Mac）
- **构建**：`npx vite build`（~4s），输出到 `dist/`
- **i18n**：vue-i18n，`src/locales/en.json` + `zh.json`

## DaisyUI v5 关键约定
- CSS 变量名：`--color-base-100/200/300`、`--color-base-content`、`--color-primary`、`--color-error` 等（v4 的 `--b1`/`--b2`/`--bc`/`--p` 不存在）
- 变量值是完整 oklch（如 `oklch(90% 0 0)`），直接 `var(--color-base-200)` 使用，不要再包 `oklch()`
- 透明度用 `color-mix(in oklch, var(--color-base-content) 70%, transparent)`，不要用 `oklch(var(...) / 0.7)` 或 `hsl(var(...) / 0.7)`

## HIG Token 层
- 位置：`src/styles/hig-tokens.css`，在 `tailwind.css` 中 `@import` 加载
- 内容：字号（`--text-hig-*`）、间距（`--spacing-hig-*`）、圆角（`--radius-hig-*`）、动效（`--hig-duration-*`/`--ease-hig-*`）、语义状态色（`--hig-success/warning/error/info` + container 变体）
- Tailwind v4 `@theme` 自动生成工具类：`text-hig-sm`、`rounded-hig-lg`、`spacing-hig-4`、`ease-hig-standard` 等
- **重要**：`@theme` 不支持 `--duration-*` 命名空间！动效时长工具类（`duration-hig-fast` 等）必须用 `@utility` 指令显式定义

## HIG 优化状态（2026-07-07）
- **P0 全部完成**：DaisyUI v4→v5 变量迁移、hsl→color-mix 修复、text-[10px]→text-xs
- **P1 全部完成**：aria-current/dialog ARIA、btn-xs→btn-sm、语义化状态色、统一透明度、Debugger ARIA live
- **P2 全部完成**：Magic Number→Token 迁移、动效时长 Token 化、Canvas/Notation ARIA、键盘快捷键提示、菜单键盘箭头导航
- **长表单 TOC（P1 子项）已撤销**：用户要求移除，2026-07-07 删除 `SettingsToc.vue`、相关 prop/i18n/双列布局

## 组件规范
- **新增设置页必须用 `SettingsSection` 包裹**，否则内容溢出 `SettingsLayout` 的 `flex-1 min-h-0` 父容器无法滚动
- `SettingsSection` 结构：外层 `h-full flex flex-col overflow-hidden` + 内层 `flex-grow-1 overflow-y-auto p-4`（滚动容器）；`show-reset` 默认 true 显示底部重置按钮，页面自带重置逻辑时传 `:show-reset="false"`
- `WaterfallPianoSettings` 曾因未包裹 `SettingsSection` 导致无法滚动，已修复
- btn-xs 仅保留在 4 处紧凑上下文（LatencyMonitor 徽章、ChordDictionaryToolbar 响应式、ChordSearch 输入框内嵌）
