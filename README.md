# MIDI-JAR

> MIDI 键盘工具 — 和弦检测、瀑布流钢琴、MIDI 文件播放，以及乐谱可视化与视唱练耳。

MIDI-JAR 是一款面向 MIDI 键盘玩家的桌面 / Web 工具集：实时识别和弦并显示在五线谱与钢琴键盘上、用瀑布流钢琴可视化演奏、回放 MIDI 文件、调音、浏览和弦/音阶词典，并通过乐谱滚动与三维乐谱把曲子“看”出来。

- **桌面端**：基于 [Tauri 2](https://v2.tauri.app/)（Rust），可调用本地 VST3 音源。
- **Web 端**：基于 Web MIDI API，无需安装即可在浏览器中使用（部分能力受浏览器限制）。

---

## 功能模块

| 模块 | 路径 | 说明 |
| --- | --- | --- |
| 和弦显示 Chord Display | `/chords/:id` | 实时检测演奏的和弦，在五线谱 + 钢琴 + 和弦名上可视化。支持多个可配置模块。 |
| 和弦词典 Chord Dictionary | `/chord-dictionary` | 查询、分组浏览和弦的结构与排列，可试听。 |
| 瀑布流钢琴 Waterfall Piano | `/waterfall-piano` | 基于 PixiJS 的瀑布流音符可视化，支持 MIDI 文件回放与录制。 |
| 音源 Sampler | `/sampler` | 加载 VST3 插件作为发声引擎（桌面端），实时演奏与音色管理。 |
| 和弦测验 Chord Quiz | `/chord-quiz` | 系统出题、用户选择和弦名的听辨/视觉测验，含成绩单。 |
| 调音器 Tuner | `/tuner` | 基于 McLeod 音高检测法的实时调音器，音分/频谱/电平显示。 |
| 乐谱滚动 Score Scroll | `/score-scroll` | 载入 MusicXML，随播放滚动可视化的二维谱面，音符命中特效。 |
| 三维乐谱 3D Score | `src/views/Score3D` | 把整首曲子铺入三维空间、随播放推进视角的可视化（开发中）。 |
| MIDI 路由 Routing | `/settings/routing` | 配置 MIDI 输入/输出设备与内部信号路由。 |
| 设置 Settings | `/settings` | 通用、光标、记谱、和弦显示、钢琴、调试等 Schema 驱动的偏好设置。 |

> 模块列表以 `src/router/index.ts` 与 `src/views/Home.vue` 为事实来源；三维乐谱尚未接入主导航。

---

## 技术栈

| 分类 | 选型 |
| --- | --- |
| 框架 | Vue 3 + TypeScript + Vite 8 |
| 桌面壳 | Tauri 2（Rust） |
| 状态管理 | Pinia |
| 国际化 | vue-i18n（简体中文 / English） |
| 样式 | TailwindCSS 4 + daisyUI 5（约束：UI 仅用 daisyUI/Tailwind 工具类，自定义 CSS 仅限渲染层） |
| 乐理 | `tonal` / `@tonaljs/chord`、`@tonaljs/scale` |
| 记谱 | VexFlow 5、OpenSheetMusicDisplay（MusicXML） |
| 渲染 | PixiJS 8（瀑布流/特效）、Three.js（三维乐谱） |
| 发声 | Tone.js、smplr（采样器引擎），VST3（`vst3-host`，桌面端） |
| MIDI | Web MIDI API（浏览器）/ Tauri 命令通道（桌面端）、`@tonejs/midi`（文件读写） |
| 测试 | Vitest + @vue/test-utils + jsdom |
| 质量 | oxlint（lint）、oxfmt（format）、vue-tsc（类型检查） |

---

## 环境要求

- **Node.js** ≥ 20.0.0（项目使用 `npm@12.0.2`，建议与之匹配）
- **Rust 工具链**：仅桌面端构建（`tauri build` / `tauri dev`）需要

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动 Web 开发服务器（默认 http://localhost:5173）
npm run dev

# 3. 或在桌面窗口中开发（需 Rust 工具链）
npm run tauri:dev
```

浏览器打开后若提示“当前浏览器不支持 Web MIDI API”，说明你的浏览器未授予 MIDI 权限——可使用 Chrome/Edge 并允许访问，或直接用桌面端。

---

## Credits

- 本项目基于上游仓库 [la-jarre-a-son/midi-jar](https://github.com/la-jarre-a-son/midi-jar) 构建与扩展。

## License

[MIT](./LICENSE)
