# 计划：修复五线谱（Notation）窗口缩小后不收缩的问题

## 根因

CSS Flexbox 的 `min-width: auto` 默认行为 + `overflow: visible` 的组合效应。

当 flex 子项的 `overflow` 为 `visible`（默认值）时，`min-width: auto` 会解析为内容的 **min-content 宽度**。VexFlow 的 Renderer 在容器内创建了一个具有固定像素 `width` 属性的 SVG 元素，这个 SVG 的固有宽度成为了容器 div 的最小宽度。结果：**容器 div 无法缩小到 SVG 当前宽度以下**，ResizeObserver 检测不到宽度变化，形成"锁死"。

## 修复方案

在受影响的容器上添加 `min-w-0`（Tailwind 的 `min-width: 0`），覆盖默认的 `min-width: auto`。

## 涉及文件

### 1. `src/components/Notation/Notation.vue`（第 5 行）

```diff
- class="notation-base w-full overflow-visible"
+ class="notation-base w-full min-w-0 overflow-visible"
```

这是根本修复点——Notation 组件自身的根容器。

### 2. `src/views/ChordDisplay/ChordDisplay.vue`（第 7 行）

```diff
- class="flex-1 flex items-center justify-center group relative"
+ class="flex-1 min-w-0 flex items-center justify-center group relative"
```

ChordDisplay 中 Notation 的外层 flex 包装器。

### 3. `src/views/ChordDictionary/Detail/ChordDetail.vue`（第 69 行）

```diff
- class="w-full p-3 bg-base-300/30 rounded-lg mb-4 overflow-visible"
+ class="w-full min-w-0 p-3 bg-base-300/30 rounded-lg mb-4 overflow-visible"
```

ChordDetail 中 Notation 的 `<section>` 包装器。

## 不受影响的组件

- **PianoKeyboard**：使用 SVG `viewBox` + CSS `width/height: 100%`，自动缩放，无此问题
- **ChordNameLink**：纯文本组件，无此问题
- **ChordIntervals**：使用 `overflow-x-auto`，无此问题

## 验证步骤

1. 启动应用，进入 ChordDisplay 页面
2. 放大窗口 → 五线谱正常放大
3. 缩小窗口 → 五线谱应跟随缩小，布局不错乱
4. 进入 ChordDictionary → 点击任意和弦 → 验证详情页五线谱同样正常缩放
