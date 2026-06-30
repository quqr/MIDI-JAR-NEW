# 计划：ChordDisplay 响应式布局 + 修复窗口控制按钮

## 概述

两项改动：

1. **ChordDisplay 响应式布局** — 窄屏时左右两栏堆叠为上下排列
2. **修复窗口控制按钮** — `window.tauriAPI` 从未被赋值，导致最小化/最大化/关闭全部失效

---

## 第一部分：修复窗口控制按钮（Bug Fix）

### 问题根因

`src/utils/tauri.ts` 创建了局部 `tauriAPI` 对象并通过 `export default` 导出，但**从未赋值给 `window.tauriAPI`**。导致：

- `AppNavbar.vue` 中 `window.tauriAPI?.window.minimize()` 等调用全部静默失败
- `onMounted` 中 `if (!api) return` 直接退出，Mac 平台检测、最大化状态监听等逻辑不执行
- 所有依赖 `window.tauriAPI` 的 MIDI 设备管理、MIDI 路由等也无法通过该路径工作

### 修复方案

**文件：`src/utils/tauri.ts`**

在 `tauriAPI` 对象定义之后，添加全局赋值：

```typescript
const tauriAPI = { ... };

// 挂载到全局 window 对象
if (isTauri()) {
  window.tauriAPI = tauriAPI;
}

export default tauriAPI;
```

这样所有通过 `window.tauriAPI` 访问的代码（AppNavbar 窗口控制、MIDI 设备管理等）都能正常工作。

---

## 第二部分：ChordDisplay 响应式布局

### 当前状态

- 左右两栏始终 `flex-1` 各占 50%，不会堆叠
- 和弦名称字号固定 `text-5xl`（48px）
- 和弦名与音程间距 `gap-20`（80px）过大
- 键盘区 `min-height: 200px` 硬编码
- 无任何 `@media` 断点

### 修改方案

**文件：`src/views/ChordDisplay/ChordDisplay.vue`**

#### 1. 主内容区：窄屏堆叠

```html
<!-- 当前 -->
<div class="flex h-full w-full gap-3">
  <!-- 左侧乐谱 flex-1 -->
  <!-- 右侧和弦信息 flex-1 -->
</div>

<!-- 改为 -->
<div class="flex flex-col md:flex-row h-full w-full gap-3">
  <!-- 左侧乐谱 flex-1 -->
  <!-- 右侧和弦信息 flex-1 -->
</div>
```

`md` 断点（768px）时切换为横向排列。

#### 2. 和弦名称字号：响应式缩小

```html
<!-- 当前 -->
<span class="text-5xl font-bold">
  <!-- 改为 -->
  <span class="text-3xl md:text-5xl font-bold"></span
></span>
```

#### 3. 和弦名与音程间距：窄屏缩小

```html
<!-- 当前 -->
<div class="flex flex-col gap-20 items-center">
  <!-- 改为 -->
  <div class="flex flex-col gap-6 md:gap-20 items-center"></div>
</div>
```

#### 4. 键盘区最小高度：响应式调整

```html
<!-- 当前 -->
style="min-height: 200px"

<!-- 改为 -->
style="min-height: 150px"
```

在 Tailwind 中用 `min-h-[150px] md:min-h-[200px]` 替代 inline style。

---

## 涉及文件

| 文件                                      | 改动                                                |
| ----------------------------------------- | --------------------------------------------------- |
| `src/utils/tauri.ts`                      | 添加 `window.tauriAPI = tauriAPI` 赋值              |
| `src/views/ChordDisplay/ChordDisplay.vue` | 添加响应式断点（堆叠布局 + 字号 + 间距 + 键盘高度） |

## 验证步骤

1. **窗口控制按钮**：启动 Tauri 应用，验证最小化/最大化/关闭按钮正常工作
2. **Mac 平台检测**：Mac 上应显示原生交通灯，Windows 上显示自定义按钮
3. **响应式布局**：拖拽窗口边缘缩小宽度，验证：
   - 宽屏（>768px）：左右并排，大字号
   - 窄屏（≤768px）：上下堆叠，字号缩小，间距缩小
4. **键盘区**：窄屏下键盘区高度适当缩小但仍可正常使用
