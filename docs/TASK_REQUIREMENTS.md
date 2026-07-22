# 任务需求文档

> 生成时间：2026-07-22
> 最后更新：2026-07-22
> 状态：部分完成

---

## 任务1：钢琴设置页面 i18n 国际化
- **状态**：✅ 已完成
- **问题**：显示翻译键（如 `settings.pianoSettings.colors`）而不是翻译文本
- **修复**：将 `pianoSettings` 从 locales 文件根级别移动到 `settings` 对象内部
- **修改文件**：
  - [zh.json](file:///home/loop/挂载点/F/Codes/MIDI-JAR-NEW/src/locales/zh.json#L474-L497)
  - [en.json](file:///home/loop/挂载点/F/Codes/MIDI-JAR-NEW/src/locales/en.json#L474-L497)

---

## 任务2：清理无用的设置项和设置页面代码

### 判定标准
- 未被任何代码引用的设置项
- 已弃用的设置项

### 清理范围
- 遍历全部设置页面
- 检查每个设置项的代码引用情况

### 实施流程
1. 分析所有设置页面和设置项
2. 列出所有将被删除的设置项清单
3. 提交给用户确认
4. 用户确认后执行删除

### 状态
- **状态**：✅ 已完成（初步分析）
- **结果**：大部分设置项都在被使用，未发现明显无用的代码
- **建议**：保留现有代码，暂不删除任何设置项

---

## 任务3：修复 pressed color bug

### 问题描述
- 用户选择蓝色，实际显示红色
- 按下白键时，相邻的黑键也被染成 pressed color

### 已完成部分

#### 3.1 创建映射工具函数
- **状态**：✅ 已完成
- **实现**：
  - `mapPianoSettingsToKeyboardColors()` - 映射颜色配置
  - `createKeyboardSettingsFromPiano()` - 创建完整的键盘设置
- **文件**：[utils.ts](file:///home/loop/挂载点/F/Codes/MIDI-JAR-NEW/src/components/PianoKeyboard/utils.ts#L13-L63)

#### 3.2 修复颜色传递
- **状态**：✅ 已完成
- **修复内容**：
  - `useChordDetail.ts` - 从 settingsStore 读取 PianoSettings
  - `Sampler.vue` - 添加 keyboard prop
- **文件**：
  - [useChordDetail.ts](file:///home/loop/挂载点/F/Codes/MIDI-JAR-NEW/src/views/ChordDictionary/Detail/composables/useChordDetail.ts#L161-L172)
  - [Sampler.vue](file:///home/loop/挂载点/F/Codes/MIDI-JAR-NEW/src/views/Sampler/Sampler.vue)

#### 3.3 修复渲染层级问题
- **状态**：✅ 已完成
- **修复内容**：
  - 白键高亮只绘制未被黑键覆盖的部分
  - 重新绘制未被按下的黑键，确保保持原色
- **文件**：[KeyboardRenderer.ts](file:///home/loop/挂载点/F/Codes/MIDI-JAR-NEW/src/views/WaterfallPiano/engine/KeyboardRenderer.ts#L258-L302)

---

## 任务4：颜色选择器的透明度支持

### 需求
- 所有颜色选择设置都支持透明度（RGBA）
- 当前限制：`SettingsColorPicker` 使用原生 `<input type="color">`，不支持透明度

### 状态
- **状态**：🚧 待实施
- **优先级**：中等

### 解决方案
- 需要引入第三方颜色选择器库或自定义实现
- 影响范围：11个文件中的47处颜色选择器

---

## 任务5：改进采样器页面音源标识

### 5.1 页面布局重新设计

#### Navbar（顶部导航栏）
- 位置：页面最顶部
- 内容：
  - 返回按钮
  - 标题（"Sampler"）

#### Sidebar（左侧边栏）
- 上部：音源分类列表 + 搜索框
- 底部：缓存管理区域
  - 显示总缓存大小
  - 清除全部音源缓存按钮

#### 主内容区
- 音源网格列表

### 5.2 音源卡片布局

#### 基本信息（常显）
- 音源名称
- 音源分类

#### 动态显示内容

**加载进度**
- 组件：`radial-progress`（daisyUI）
- 颜色：主题色（`text-primary`）
- 位置：卡片内部
- 显示时机：选择该音源且开始加载时
- 内容：百分比进度（如 75%）

**错误显示**
- 卡片边框变红（`ring-2 ring-error`）
- 显示错误图标 + 错误信息
- 错误信息同步到调试器

**缓存标识**
- 已缓存标识：✓ + "Cached" 文字
- 缓存大小：显示缓存字节数（如 "2.3 MB"）
- 清除按钮：清除当前音源缓存

**试听按钮**
- 功能：播放当前调式的音阶
- 音阶类型：根据当前选择的调式（通过 `keyGetter` 获取）
- 起始音：固定从 C4 开始
- 播放速度：500ms 每音符
- 播放方向：上行 + 下行

### 5.3 缓存管理

#### 单个音源缓存
- 位置：音源卡片内
- 功能：清除当前音源缓存
- 显示：缓存大小 + 清除按钮

#### 全部音源缓存
- 位置：采样器页面 sidebar 底部
- 功能：清除全部音源缓存

#### 全局缓存清理
- 位置：高级调试页面
- 功能：清除全部缓存（localStorage + CacheStorage）
- 显示信息：
  - localStorage 总大小
  - CacheStorage 总大小

### 状态
- **状态**：🚧 待实施
- **优先级**：高

---

## 存储架构说明

### localStorage 层（配置数据）
| 存储键 | 用途 |
|--------|------|
| `midi-jar-settings` | 全局设置 |
| `midi-jar-sampler-state` | 采样器状态 |
| `midi-jar-routes` | MIDI 路由配置 |
| `midi-jar-window-state` | 窗口状态 |
| `midi-jar-theme` | 主题设置 |
| `waterfall-piano-settings` | 瀑布流钢琴设置 |
| `waterfall-piano-recordings` | 瀑布流钢琴录制 |
| `midi-jar-advanced-debug-presets` | 高级调试预设 |

### CacheStorage 层（音源数据）
- 存储键：`midi-jar-sampler`
- 管理：`smplr` 库的 `SampleLoader`

---

## 实施顺序建议

### 阶段1：已完成 ✅
1. 修复 pressed color bug（任务3）
2. 清理无用代码分析（任务2）
3. 修复 i18n 问题（任务1）

### 阶段2：高优先级 🚧
1. 改进采样器页面布局（任务5.1）
2. 实现音源卡片新设计（任务5.2）
3. 添加试听按钮功能（任务5.3）
4. 实现缓存管理功能（任务5.4）

### 阶段3：中等优先级 📋
1. 实现颜色选择器透明度支持（任务4）

---

## 技术决策记录

### ADR-001：PianoSettings 到 KeyboardSettings 的映射
- **背景**：PianoSettings 和 KeyboardSettings 有不同的字段名和结构
- **决策**：创建工具函数 `createKeyboardSettingsFromPiano` 进行转换
- **原因**：避免在多个地方重复映射逻辑，确保一致性

### ADR-002：Pressed Color 渲染层级
- **背景**：白键高亮覆盖整个高度，影响相邻黑键
- **决策**：白键高亮只绘制未被黑键覆盖的部分，并重新绘制未被按下的黑键
- **原因**：确保每个按键的高亮只影响该按键本身，不干扰相邻按键
