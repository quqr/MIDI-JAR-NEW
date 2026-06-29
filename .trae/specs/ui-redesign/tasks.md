# Tasks

## 阶段一：地基——色彩系统与基础设施 ✅

- [x] Task 1: 硬编码颜色全量清除
- [x] Task 2: 主题系统重配
- [x] Task 3: 共享基础设施建立

## 阶段二：核心组件重写 ✅

- [x] Task 4: ChordName 激进重写

## 阶段三：导航系统重构 ✅

- [x] Task 5: AppNavbar 极简浮动化
- [x] Task 6: 调号选择器 + 首页搜索

## 阶段四：五个核心页面激进重设计 ✅

- [x] Task 7: ChordDictionary 重设计
- [x] Task 8: ChordDisplay 重设计
- [x] Task 9: ChordQuiz 重设计
- [x] Task 10: CircleOfFifths 重设计
- [x] Task 11: Layout 整体优化

## 阶段五：细节打磨与交互增强 ✅

- [x] Task 12: 微交互与动画系统
- [x] Task 13: 空状态 / ModuleCard / ChordDetail
- [x] Task 14: 可访问性 + Widget 增强

# Task Dependencies
```
阶段一 (Task 1, 2, 3) ── 并行，无依赖
    │
    ├──→ 阶段二 (Task 4) ── 依赖 Task 1
    │
    └──→ 阶段三 (Task 5, 6) ── 与阶段二并行
              │
              ▼
         阶段四 (Task 7, 8, 9, 10, 11) ── 依赖 Task 4 + Task 5
              │
              ▼
         阶段五 (Task 12, 13, 14) ── 并行，无相互依赖
```