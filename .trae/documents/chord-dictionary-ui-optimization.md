# 和弦词典 UI 布局优化计划 - 智能动态导航

## 1. 项目概述

### 1.1 当前状态分析

**技术栈**: Vue 3 + TypeScript + Vite + Tailwind CSS 4 + DaisyUI 5 + Pinia + Tauri

**当前布局结构** (ChordDictionary.vue):
```
┌─────────────────────────────────────────────────────────────┐
│  ChordDictionaryToolbar (搜索、分组、过滤、检测/播放切换)      │
├──────────┬──────────┬───────────────────────────────────────┤
│ ChromaMenu│ChordMenu │         RouterView (ChordDetail)      │
│  w-48     │  w-56    │         flex-1                        │
│  192px    │  224px   │         剩余宽度                      │
│ 音高选择   │和弦类型   │         和弦详情                      │
└──────────┴──────────┴───────────────────────────────────────┘
```

**已识别的问题**:
1. **空间浪费**: 两列导航占416px固定宽度，在小屏幕上严重挤压详情区域
2. **交互冗长**: 必须先选音高→再选和弦类型→才能看到详情，需多次点击
3. **搜索隐藏**: 搜索按钮是普通按钮，不够突出，用户难以快速找到
4. **响应式不足**: 仅有少量媒体查询（AppNavbar中有768px断点），和弦词典页面无响应式适配
5. **视觉层级不清**: 工具栏功能堆叠，缺乏层次感

### 1.2 优化目标
- 实现智能动态导航，根据屏幕尺寸自动调整布局
- 简化交互流程，减少操作步骤
- 建立清晰的视觉层级
- 确保在不同设备尺寸下都有良好的使用体验

---

## 2. 响应式断点策略

### 2.1 断点定义
基于 Tailwind CSS 标准断点和项目需求：

| 断点名称 | 宽度范围 | 布局策略 |
|---------|---------|---------|
| **xl** (大屏) | ≥1280px | 三列布局：左侧音高菜单 + 中间和弦类型菜单 + 右侧详情 |
| **lg** (中大屏) | 1024px - 1279px | 两列布局：左侧合并导航 + 右侧详情 |
| **md** (中屏) | 768px - 1023px | 顶部标签栏 + 垂直和弦列表 + 详情 |
| **sm** (小屏) | <768px | 全屏详情 + 底部抽屉/下拉选择器 |

### 2.2 各断点详细布局

#### 大屏 (xl ≥ 1280px) - 保持现有布局
```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar: [搜索框(展开)] [分组▼] [过滤▼] [检测|播放] [设置⚙]  │
├──────────┬──────────┬───────────────────────────────────────┤
│ ChromaMenu│ChordMenu │         ChordDetail                   │
│  w-48     │  w-56    │         flex-1                        │
└──────────┴──────────┴───────────────────────────────────────┘
```

#### 中大屏 (lg 1024-1279px) - 合并导航
```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar: [搜索框] [音高选择横向标签] [分组▼] [设置⚙]         │
├──────────────────┬──────────────────────────────────────────┤
│    ChordMenu     │         ChordDetail                      │
│    w-52          │         flex-1                           │
│  (和弦类型列表)   │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

#### 中屏 (md 768-1023px) - 顶部标签 + 折叠
```
┌─────────────────────────────────────────────────────────────┐
│  [搜索框(居中)] [音高标签栏(横向滚动)]                        │
├─────────────────────────────────────────────────────────────┤
│  [展开和弦列表] ← 可折叠按钮                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     ChordDetail                             │
│                     (全宽显示)                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 小屏 (sm <768px) - 全屏 + 抽屉
```
┌─────────────────────────────────────────────────────────────┐
│  [搜索图标] [当前和弦名称] [汉堡菜单☰]                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     ChordDetail                             │
│                     (全屏显示)                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [底部抽屉: 音高选择 + 和弦类型选择]                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 具体实现方案

### 3.1 创建响应式布局 Composable

**新增文件**: `src/composables/useResponsiveLayout.ts`

```typescript
// 响应式布局状态管理
// 检测屏幕尺寸，提供当前断点和布局状态
// 使用 window.matchMedia API 实时响应尺寸变化
```

**功能**:
- 检测当前屏幕宽度
- 提供响应式状态（`breakpoint`, `isMobile`, `isTablet`, `isDesktop`）
- 提供导航状态（`sidebarOpen`, `drawerOpen`）
- 提供切换函数（`toggleSidebar`, `toggleDrawer`）

### 3.2 重构 ChordDictionary.vue

**修改文件**: `src/views/ChordDictionary/ChordDictionary.vue`

**变更内容**:
1. 引入 `useResponsiveLayout` composable
2. 根据断点动态切换布局模式
3. 使用条件渲染展示不同导航组件

```vue
<template>
  <ChordDictionaryModuleProvider ...>
    <!-- 工具栏：根据断点显示不同内容 -->
    <ChordDictionaryToolbar :layout-mode="layoutMode" />

    <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
      <!-- 大屏：保持三列布局 -->
      <div v-if="layoutMode === 'desktop'" class="flex flex-row flex-1 min-h-0">
        <ChordDictionaryChromaMenu ... />
        <ChordDictionaryChordMenu ... />
        <div class="flex-1 min-h-0 overflow-y-auto">
          <RouterView />
        </div>
      </div>

      <!-- 中屏：顶部标签 + 侧边和弦列表 -->
      <template v-else-if="layoutMode === 'tablet'">
        <ChromaTagBar ... /> <!-- 新组件：横向音高标签 -->
        <div class="flex flex-row flex-1 min-h-0">
          <ChordDictionaryChordMenu v-show="chordMenuVisible" ... />
          <div class="flex-1 min-h-0 overflow-y-auto">
            <RouterView />
          </div>
        </div>
      </template>

      <!-- 小屏：全屏详情 + 底部抽屉 -->
      <template v-else>
        <div class="flex-1 min-h-0 overflow-y-auto">
          <RouterView />
        </div>
        <MobileNavDrawer ... /> <!-- 新组件：移动端导航抽屉 -->
      </template>
    </div>
  </ChordDictionaryModuleProvider>
</template>
```

### 3.3 新增组件

#### 3.3.1 ChromaTagBar (横向音高标签栏)

**新增文件**: `src/views/ChordDictionary/ChromaTagBar.vue`

**功能**:
- 横向排列12个音高标签
- 支持横向滚动（移动端）
- 高亮当前选中的音高
- 支持调内音高过滤

```vue
<template>
  <div class="chroma-tag-bar flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
    <button
      v-for="note in notesList"
      :key="note"
      class="btn btn-sm min-w-[40px]"
      :class="selected === getChroma(note) ? 'btn-primary' : 'btn-ghost'"
      @click="handleSelect(note)"
    >
      {{ formatNote(note) }}
    </button>
  </div>
</template>
```

#### 3.3.2 MobileNavDrawer (移动端导航抽屉)

**新增文件**: `src/views/ChordDictionary/MobileNavDrawer.vue`

**功能**:
- 底部固定抽屉，可上拉展开
- 包含音高选择和和弦类型选择
- 显示当前选中的和弦信息
- 支持手势操作

```vue
<template>
  <div class="mobile-nav-drawer sticky bottom-0 z-30 bg-base-200 shadow-lg">
    <!-- 收起状态：显示当前选择和展开按钮 -->
    <div class="drawer-handle flex items-center justify-between px-4 py-2">
      <div class="current-selection">
        <ChordName v-if="chord" :chord="chord" />
        <span v-else class="text-base-content/50">{{ t('chordDictionary.selectChord') }}</span>
      </div>
      <button class="btn btn-sm btn-ghost" @click="expanded = !expanded">
        <Icon :name="expanded ? 'chevron-down' : 'chevron-up'" />
      </button>
    </div>

    <!-- 展开状态：显示选择器 -->
    <div v-show="expanded" class="drawer-content max-h-[60vh] overflow-y-auto">
      <ChromaTagBar ... />
      <ChordDictionaryChordMenu ... />
    </div>
  </div>
</template>
```

#### 3.3.3 SearchOverlay (搜索覆盖层)

**新增文件**: `src/views/ChordDictionary/SearchOverlay.vue`

**功能**:
- 全屏搜索覆盖层（移动端友好）
- 实时搜索结果
- 显示搜索历史
- 键盘导航支持

### 3.4 重构 ChordDictionaryToolbar.vue

**修改文件**: `src/views/ChordDictionary/ChordDictionaryToolbar.vue`

**变更内容**:
1. 接收 `layoutMode` prop
2. 根据断点调整工具栏布局
3. 在移动端将搜索改为图标按钮，点击打开搜索覆盖层
4. 整合常用功能，减少操作层级

```vue
<template>
  <div class="toolbar flex items-center gap-2 px-3 py-2 border-b border-base-200 bg-base-100">
    <!-- 桌面端：完整搜索框 -->
    <template v-if="layoutMode === 'desktop' || layoutMode === 'tablet'">
      <ChordSearch :on-select="handleChordSelect" />
      <div class="divider divider-horizontal mx-0"></div>
      <GroupByDropdown ... />
    </template>

    <!-- 移动端：搜索图标 -->
    <template v-else>
      <button class="btn btn-sm btn-ghost btn-circle" @click="showSearch = true">
        <Icon name="search" :size="20" />
      </button>
    </template>

    <!-- 通用功能 -->
    <div class="flex-1"></div>
    
    <!-- 检测/播放切换（仅非widget模式） -->
    <div v-if="!disableUpdate" class="btn-group">
      <button class="btn btn-sm" :class="interactiveMode === 'detect' ? 'btn-active' : 'btn-outline'"
        @click="handleToggleInteractive('detect')">
        {{ t('chordDictionary.detect') }}
      </button>
      <button class="btn btn-sm" :class="interactiveMode === 'play' ? 'btn-active' : 'btn-outline'"
        @click="handleToggleInteractive('play')">
        {{ t('chordDictionary.play') }}
      </button>
    </div>

    <SettingsButton @click="settingsOpen = true" />
  </div>

  <!-- 搜索覆盖层（移动端） -->
  <SearchOverlay v-if="showSearch" @close="showSearch = false" />
</template>
```

### 3.5 重构 ChordDetail.vue

**修改文件**: `src/views/ChordDictionary/Detail/ChordDetail.vue`

**变更内容**:
1. 响应式调整详情区域布局
2. 在小屏幕上将并排的卡片改为垂直堆叠
3. 优化钢琴键盘在