# Wayfinder: GitHub Pages 迁移可行性探究

## Destination

评估将 MIDI-JAR 项目迁移到 GitHub Pages 的可行性，明确哪些功能可以保留、哪些需要降级，并给出明确的推荐方案。

## Notes

- 项目已有双模式设计：`isTauri()` / `runInTauri()` 已在 30+ 处使用
- Vite 配置中 `base: "./"` 已支持相对路径部署
- 核心冲突：Tauri 专有功能 vs Web 标准能力

## Decisions so far

1. **迁移方案**: B. 双版本并行（保留 Tauri 桌面版 + 发布 Web 精简版）
2. **功能范围**: C. 全功能版（Web MIDI API 仅 Chrome 支持）
3. **代码管理**: B. 独立分支
4. **部署方式**: A. 自动部署（推送到 main 自动触发）

## 技术分析

### 当前架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vue 3)                      │
├─────────────────────────────────────────────────────────┤
│  MidiMessageManager  ←──── Tauri Event System ────→ Rust │
│  MidiDeviceManager   ←──── Tauri Invoke ──────────→ Rust │
│  midiRouting store   ←──── Tauri Invoke ──────────→ Rust │
└─────────────────────────────────────────────────────────┘
```

### Tauri 专有功能清单

| 功能 | 位置 | Web 替代方案 |
|------|------|-------------|
| MIDI 设备发现 | `MidiDeviceManager.ts` | Web MIDI API (`navigator.requestMIDIAccess`) |
| MIDI 消息收发 | `MidiMessageManager.ts` | Web MIDI API |
| MIDI 设备路由 | `midiRouting.ts` | 无（需移除或简化） |
| 虚拟 MIDI 端口 | `tauri.ts` midi API | 无（浏览器不支持） |
| 文件系统读写 | `tauri.ts` fileSystem API | File API / 拖拽上传 |
| 窗口管理 | `tauri.ts` window API | 隐藏/禁用 |
| 窗口状态持久化 | `windowState.ts` | localStorage |

### 功能兼容性矩阵

| 功能 | Tauri | Web (Chrome) | Web (其他) | 说明 |
|------|:-----:|:------------:|:----------:|------|
| 和弦显示 | ✅ | ✅ | ✅ | Tonal.js 纯 JS |
| 和弦词典 | ✅ | ✅ | ✅ | 纯数据 + 渲染 |
| 瀑布流钢琴 | ✅ | ✅ | ⚠️ | Canvas 可行，实时输入受限 |
| MIDI 文件播放 | ✅ | ✅ | ✅ | @tonejs/midi 纯 JS |
| 实时 MIDI 输入 | ✅ | ✅ | ❌ | Web MIDI API 仅 Chrome |
| MIDI 设备路由 | ✅ | ⚠️ | ❌ | Chrome 可用，无虚拟端口 |
| 文件操作 | ✅ | ✅ | ✅ | 改用 File API |
| 窗口控制 | ✅ | ❌ | ❌ | 浏览器不支持 |
| 设置持久化 | ✅ | ✅ | ✅ | localStorage |

### 需要修改的文件

**核心修改（必做）:**
1. `src/midi/MidiMessageManager.ts` - 添加 Web MIDI API 实现
2. `src/midi/MidiDeviceManager.ts` - 添加 Web MIDI API 实现
3. `src/utils/tauri.ts` - 添加 Web fallback
4. `src/router/index.ts` - 考虑 hash history

**可选修改:**
5. `src/views/WaterfallPiano/composables/useVisibilityRefresh.ts` - 隐藏窗口相关逻辑
6. `src/stores/windowState.ts` - 禁用窗口状态功能

### GitHub Pages 部署配置

```yaml
# .github/workflows/deploy-web.yml
name: Deploy Web to GitHub Pages
on:
  push:
    branches: [web]  # 独立分支
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build  # 需要添加 web 构建脚本
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Not yet specified

（无）

## Out of scope

（无）
