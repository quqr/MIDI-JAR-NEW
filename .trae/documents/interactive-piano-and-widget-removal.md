# 计划：ChordDisplay 交互式钢琴 + 移除 Widget

## 概述

两项改动：

1. **ChordDisplay 钢琴改为可交互** — 用户可以点击琴键，音符进入 `useNotes` 的和弦检测流程（与 MIDI 输入互斥）
2. **移除 Widget/弹出窗口功能** — 删除所有 Widget 相关的前后端代码

同时**移除 ChordDetail 的交互逻辑**（保留 PianoKeyboard 组件层的 clickable 基础设施）。

## 决策记录

| 决策             | 结论                                                               |
| ---------------- | ------------------------------------------------------------------ |
| ChordDetail 交互 | 完全移除所有交互逻辑（selectedMidis, onNoteClick, detectChord 等） |
| 点击行为模型     | Toggle 模式（点击加入，再点击移除）                                |
| 输入互斥         | 点击 → 清除 MIDI 音符；MIDI 弹奏 → 清除点击音符                    |
| 实现位置         | 扩展 `useNotes` composable                                         |
| Widget           | 完全移除（前后端 + Tauri 配置）                                    |
| clickable 设置   | 始终开启，不加设置项                                               |
| 清除机制         | 手动 toggle + 切换模块时自动清除                                   |

---

## 第一部分：扩展 useNotes composable

**文件：** `src/composables/useNotes.ts`

### 改动内容

1. **新增 `clickedMidiNotes` ref** — 追踪用户点击的 MIDI 音符
2. **新增 `toggleNote(midi)` 函数** — 核心 toggle 逻辑：
   - 如果 `midi` 已在 `clickedMidiNotes` 中 → 移除
   - 如果不在 → 添加
   - **互斥：** 每次 toggle 前清空 `playedMidiNotes` 和 `sustainedMidiNotes`（清除 MIDI 输入）
   - 调用 `recomputeFromMidiNotes()` 重新计算和弦
3. **修改 `handleNoteOn(midi)`** — 在现有逻辑前增加：清空 `clickedMidiNotes`（MIDI 输入清除点击）
4. **修改 `recomputeFromMidiNotes()`** — 将 `clickedMidiNotes` 纳入合并：
   ```typescript
   const currentMidiNotes = [
     ...sustainedMidiNotes.value,
     ...playedMidiNotes.value,
     ...clickedMidiNotes.value, // 新增
   ];
   ```
5. **新增 `clearClickedNotes()` 函数** — 仅清除点击音符（供模块切换时调用）
6. **修改 `clearNotes()`** — 同时清空 `clickedMidiNotes`
7. **修改返回值** — 暴露 `toggleNote`, `clearClickedNotes`, `clickedMidiNotes`

### 注意事项

- `clickedMidiNotes` 在显示时需要和 `playedMidiNotes` 一样被传给 PianoKeyboard 的 `played` prop，以实现红色高亮
- `handleNoteOn/Off` 不应影响 `clickedMidiNotes` 中的音符（它们是独立的来源），只需清空整个列表

---

## 第二部分：ChordDisplay 启用交互

**文件：** `src/views/ChordDisplay/ChordDisplay.vue`

### 改动内容

1. **PianoKeyboard 添加 `:clickable="true"` 和 `@note-click`**
   ```vue
   <PianoKeyboard ... :clickable="true" @note-click="onNoteClick" />
   ```
2. **新增 `onNoteClick(midi)` 处理函数** — 调用 `useNotes` 暴露的 `toggleNote(midi)`
3. **将 `clickedMidiNotes` 合并到 `played` prop** — 使点击的音符显示为红色高亮
4. **模块切换时清除点击音符** — 监听模块 ID 变化，调用 `clearClickedNotes()`
5. **移除所有 Widget/Pop-out 相关代码**（见第四部分）

---

## 第三部分：移除 ChordDetail 交互逻辑

**文件：** `src/views/ChordDictionary/Detail/ChordDetail.vue`

### 移除内容

- `selectedMidis` ref
- `onNoteClick(midi)` 函数
- `detectChord()` 函数（基于点击的和弦检测）
- `clearSelected()` 函数
- `combinedPlayedMidi` 计算属性
- `watch(selectedMidis, ...)` watcher
- PianoKeyboard 上的 `:clickable="true"` 和 `@note-click="onNoteClick"`
- 所有引用上述内容的 template 代码

### 保留内容

- PianoKeyboard 组件层的 `clickable` prop 和 `noteClick` emit（ChordDisplay 会用）
- 转位钢琴展示（只读模式，不受影响）

---

## 第四部分：移除 Widget 功能

### 删除文件（5 个）

| 文件                                  | 说明                |
| ------------------------------------- | ------------------- |
| `src/views/Widget/WidgetPage.vue`     | Widget 主页面       |
| `src/views/Widget/WidgetTitleBar.vue` | Widget 自定义标题栏 |
| `src/views/Widget/index.ts`           | Barrel 导出         |
| `src/stores/widget.ts`                | Widget Pinia store  |
| `src/types/widget.ts`                 | Widget 类型定义     |

### 修改前端文件（7 个）

1. **`src/types/index.ts`** — 删除 `export * from "./widget"`
2. **`src/utils/tauri.ts`** — 删除整个 `widget` 对象（6 个方法）
3. **`src/types/tauri.d.ts`** — 删除 `widget` 类型接口
4. **`src/router/index.ts`** — 删除 widget 路由定义
5. **`src/main.ts`** — 删除 `useWidgetStore` 导入和 `restoreWidgets()` 函数及其调用
6. **`src/App.vue`** — 删除 `isWidgetRoute` 计算属性，简化 template（移除条件渲染）
7. **`src/views/ChordDisplay/ChordDisplay.vue`** — 删除：
   - `useWidgetStore` 导入和使用
   - `WidgetType` 类型导入
   - 4 个 `isXxxPoppedOut` 计算属性
   - `popOut()` 函数
   - `onMounted`/`onUnmounted` 中的 widget 监听器
   - 所有 "Pop out" 按钮和 `@contextmenu.prevent="popOut(...)"`
   - `displayXxx` 计算属性中的 `!isXxxPoppedOut` 条件

### 修改 Rust 后端（1 个）

**`src-tauri/src/lib.rs`** — 删除：

- `WidgetWindowState` 结构体
- `WIDGET_STATE_FILE` 常量
- `get_widget_state_path()`, `load_widget_states()`, `save_widget_states()` 函数
- 5 个 Tauri 命令：`create_widget_window`, `close_widget_window`, `get_widget_states`, `save_widget_states_cmd`, `get_all_widget_windows`
- `invoke_handler` 中对应的命令注册

### 修改 Tauri 配置（1 个）

**`src-tauri/capabilities/default.json`** — `"windows": ["main", "widget-*"]` 改为 `"windows": ["main"]`，更新 description

---

## 执行顺序

1. **第一步：扩展 useNotes** — 新增 `clickedMidiNotes`, `toggleNote`, `clearClickedNotes`，修改 `handleNoteOn` 和 `recomputeFromMidiNotes`
2. **第二步：ChordDisplay 启用交互** — 添加 `clickable`、`onNoteClick`、合并 `played` prop、模块切换清除
3. **第三步：移除 ChordDetail 交互逻辑** — 清理所有交互相关代码
4. **第四步：移除 Widget** — 先删文件，再改引用文件，最后改 Rust 后端和 Tauri 配置

---

## 验证步骤

1. **ChordDisplay 点击交互：**
   - 点击琴键 → 音符高亮（红色），和弦被检测显示
   - 再点击同一琴键 → 音符取消高亮
   - MIDI 弹奏 → 点击的音符被清除，MIDI 音符显示
   - 点击琴键 → MIDI 音符被清除，点击音符显示
   - 切换模块 → 点击音符被清除
2. **ChordDetail：**
   - 钢琴只读展示，不可点击
   - 和弦检测仍通过 MIDI 输入或路由参数正常工作
   - 转位展示不受影响
3. **Widget 移除：**
   - 无 Pop Out 按钮和右键菜单
   - 应用正常启动无报错
   - Tauri 构建成功
4. **PianoKeyboard 组件：**
   - `clickable` prop 和 `noteClick` emit 仍正常工作（ChordDisplay 使用）
   - 两套皮肤（classic/flat）的点击都正常
