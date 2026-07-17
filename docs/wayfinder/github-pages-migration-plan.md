# MIDI-JAR GitHub Pages 迁移计划

## 方案概述

| 项目 | 选择 |
|------|------|
| 迁移方案 | B. 双版本并行 |
| 功能范围 | C. 全功能版（Web MIDI API，仅 Chrome） |
| 代码管理 | B. 独立分支 (`web`) |
| 部署方式 | A. 自动部署（推送到 main 触发） |

---

## Phase 1: 基础设施

### 1.1 创建 `web` 分支
- 从 main 创建 `web` 分支
- 配置 GitHub Actions 自动部署

### 1.2 构建脚本
- 添加 `npm run build:web` 脚本
- 区分 Tauri/Web 构建产物

---

## Phase 2: Web MIDI API 桥接层

### 2.1 `src/midi/WebMidiDeviceManager.ts`（新建）
- 实现 `navigator.requestMIDIAccess()` 
- 设备发现/热插拔监听
- 与现有 `MidiDeviceManager` 接口对齐

### 2.2 `src/midi/WebMidiMessageManager.ts`（新建）
- Web MIDI 消息收发
- 命名空间隔离（复用现有模式）
- 替代 `InternalMidiMessages` 的 Tauri 依赖

### 2.3 `src/utils/tauri.ts` 修改
- 添加 Web MIDI fallback 分支
- `isTauri()` 为 false 时使用 Web MIDI 实现

---

## Phase 3: 功能适配

### 3.1 文件操作
- `src/utils/tauri.ts` fileSystem API
- 改用 `<input type="file">` + File API
- 拖拽上传支持

### 3.2 窗口管理
- `src/views/WaterfallPiano/composables/useVisibilityRefresh.ts`
- Web 环境下隐藏窗口控制按钮
- 禁用 always-on-top 功能

### 3.3 MIDI 路由简化
- `src/stores/midiRouting.ts`
- Web 版仅支持物理设备路由
- 移除虚拟端口相关 UI

---

## Phase 4: 路由与部署

### 4.1 路由配置
- `src/router/index.ts`
- 考虑使用 `createWebHashHistory()` 兼容静态托管

### 4.2 GitHub Actions
```yaml
# .github/workflows/deploy-web.yml
on:
  push:
    branches: [web]
```

---

## Phase 5: 测试与验证

### 5.1 功能测试
- [ ] 和弦显示/词典
- [ ] MIDI 文件播放（拖拽上传）
- [ ] 实时 MIDI 输入（Chrome）
- [ ] 瀑布流钢琴可视化
- [ ] 设置持久化

### 5.2 浏览器兼容性
- [ ] Chrome/Edge（完整功能）
- [ ] Firefox/Safari（降级提示）

---

## 关键文件清单

| 文件 | 操作 |
|------|------|
| `src/midi/WebMidiDeviceManager.ts` | 新建 |
| `src/midi/WebMidiMessageManager.ts` | 新建 |
| `src/utils/tauri.ts` | 修改 |
| `src/midi/MidiDeviceManager.ts` | 修改 |
| `src/midi/MidiMessageManager.ts` | 修改 |
| `src/stores/midiRouting.ts` | 修改 |
| `src/views/WaterfallPiano/composables/useVisibilityRefresh.ts` | 修改 |
| `.github/workflows/deploy-web.yml` | 新建 |
| `package.json` | 修改（添加 build:web 脚本） |

---

## 风险与限制

1. **Firefox/Safari 不支持 Web MIDI**：约 3-4% 用户无法使用实时 MIDI
2. **虚拟端口不可用**：浏览器无法作为 MIDI 源供 DAW 使用
3. **Chrome 权限提示**：首次使用需用户授权 MIDI 访问
