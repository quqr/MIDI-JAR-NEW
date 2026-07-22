# 实施计划

> 创建时间：2026-07-22
> 基于任务需求文档：[TASK_REQUIREMENTS.md](./TASK_REQUIREMENTS.md)

---

## 📋 项目概览

### 目标
改进 MIDI-JAR 项目的采样器页面和钢琴设置，修复多个 bug，并优化代码结构。

### 进度
- **已完成**：60%
- **待实施**：40%

---

## ✅ 阶段1：已完成任务

### 任务1：钢琴设置页面 i18n 国际化
- **状态**：✅ 已完成
- **耗时**：约 1 小时
- **关键成果**：
  - 修复了翻译键显示问题
  - 更新了 zh.json 和 en.json 文件

### 任务2：清理无用代码
- **状态**：✅ 已完成（初步分析）
- **耗时**：约 30 分钟
- **关键成果**：
  - 确认大部分设置项都在被使用
  - 建议保留现有代码

### 任务3：修复 pressed color bug
- **状态**：✅ 已完成
- **耗时**：约 2 小时
- **关键成果**：
  - 创建了映射工具函数
  - 修复了颜色传递问题
  - 解决了渲染层级问题
  - 类型检查通过 ✅

---

## 🚧 阶段2：采样器页面改进（高优先级）

### 任务5.1：页面布局重新设计
**预估耗时**：3-4 小时

#### 子任务
1. **创建 Navbar 组件**
   - 文件：`src/views/Sampler/components/SamplerNavbar.vue`
   - 内容：返回按钮 + 标题
   - 位置：页面最顶部

2. **重构 Sidebar 组件**
   - 文件：`src/views/Sampler/components/SamplerSidebar.vue`
   - 上部：音源分类列表 + 搜索框
   - 底部：缓存管理区域

3. **更新主布局**
   - 文件：`src/views/Sampler/Sampler.vue`
   - 结构：Navbar + Sidebar + 主内容区

#### 验收标准
- [ ] Navbar 在页面最顶部显示
- [ ] Sidebar 上部显示分类列表和搜索框
- [ ] Sidebar 底部显示缓存管理
- [ ] 响应式布局正常工作

---

### 任务5.2：音源卡片改进
**预估耗时**：4-5 小时

#### 子任务
1. **实现 radial-progress 加载进度**
   - 使用 daisyUI 的 `radial-progress` 组件
   - 显示百分比进度
   - 颜色：`text-primary`

2. **添加错误显示**
   - 卡片边框变红（`ring-2 ring-error`）
   - 显示错误图标 + 错误信息
   - 同步到调试器

3. **添加缓存标识**
   - 显示 ✓ + "Cached" 文字
   - 显示缓存大小（如 "2.3 MB"）
   - 添加清除缓存按钮

#### 技术要点
```vue
<!-- radial-progress 示例 -->
<div
  class="radial-progress text-primary"
  style="--value: 75; --size: 2.5rem; --thickness: 3px;"
  role="progressbar"
>
  75%
</div>
```

#### 验收标准
- [ ] 加载时显示 radial-progress
- [ ] 错误时卡片边框变红，显示错误信息
- [ ] 已缓存显示 ✓ + 大小
- [ ] 清除缓存按钮正常工作

---

### 任务5.3：试听按钮功能
**预估耗时**：2-3 小时

#### 子任务
1. **创建播放音阶函数**
   - 文件：`src/composables/useScalePlayer.ts`
   - 功能：播放当前调式的音阶
   - 参数：起始音（C4）、速度（500ms）、方向（上行+下行）

2. **添加试听按钮到卡片**
   - 位置：音源卡片右上角
   - 图标：播放图标
   - 点击触发音阶播放

3. **获取当前调式**
   - 使用 `useNoteConfig` 的 `keyGetter`
   - 根据 `KeySignature` 获取音阶

#### 技术要点
```typescript
// 音阶播放伪代码
async function playScale(
  key: string,        // 如 "C"
  startOctave = 4,    // C4
  duration = 500,     // 500ms
) {
  const scaleNotes = getKeySignature(key).scale; // C大调: ["C", "D", "E", "F", "G", "A", "B"]
  const notes = scaleNotes.map((n, i) => `${n}${i < 7 ? startOctave : startOctave + 1}`);

  // 上行
  for (const note of notes) {
    await playNote(note, duration);
  }

  // 下行
  for (const note of [...notes].reverse()) {
    await playNote(note, duration);
  }
}
```

#### 验收标准
- [ ] 点击试听按钮播放音阶
- [ ] 音阶为当前选择的调式
- [ ] 从 C4 开始播放
- [ ] 播放速度为 500ms
- [ ] 上行 + 下行播放

---

### 任务5.4：缓存管理功能
**预估耗时**：2-3 小时

#### 子任务
1. **实现单个音源缓存清除**
   - 位置：音源卡片内
   - 显示缓存大小
   - 清除当前音源缓存

2. **实现全部音源缓存清除**
   - 位置：Sidebar 底部
   - 显示总缓存大小
   - 清除全部音源缓存

3. **高级调试页面缓存管理**
   - 显示 localStorage 大小
   - 显示 CacheStorage 大小
   - 清除全部缓存（localStorage + CacheStorage）

#### 技术要点
```typescript
// 获取缓存大小
async function getCacheSize(): Promise<number> {
  const cache = await caches.open('midi-jar-sampler');
  const keys = await cache.keys();
  let size = 0;
  for (const key of keys) {
    const response = await cache.match(key);
    if (response) {
      const blob = await response.blob();
      size += blob.size;
    }
  }
  return size;
}

// 清除单个音源缓存
async function clearInstrumentCache(instrumentId: string) {
  const cache = await caches.open('midi-jar-sampler');
  const keys = await cache.keys();
  for (const key of keys) {
    if (key.url.includes(instrumentId)) {
      await cache.delete(key);
    }
  }
}
```

#### 验收标准
- [ ] 显示单个音源缓存大小
- [ ] 清除单个音源缓存正常工作
- [ ] 显示总缓存大小
- [ ] 清除全部缓存正常工作
- [ ] 高级调试页面显示 localStorage 和 CacheStorage 大小

---

## 📋 阶段3：颜色选择器透明度支持（中等优先级）

### 任务4：实现透明度支持
**预估耗时**：5-6 小时

#### 子任务
1. **选择颜色选择器库**
   - 选项：vue-color, v-color-picker, 自定义实现
   - 评估：功能、体积、维护状态

2. **创建新的颜色选择器组件**
   - 文件：`src/components/Settings/SettingsColorPickerWithAlpha.vue`
   - 支持 RGBA 格式
   - 保持与现有组件的 API 兼容

3. **替换所有颜色选择器**
   - 影响文件：11个文件
   - 影响位置：47处
   - 测试所有颜色选择功能

4. **更新类型定义**
   - 更新颜色字段类型：`string` → `string`（RGBA 格式）
   - 添加颜色验证函数

#### 验收标准
- [ ] 所有颜色选择器支持透明度
- [ ] RGBA 格式正确保存
- [ ] 颜色正确应用到 UI
- [ ] 向后兼容（RGB 格式仍然支持）

---

## 📊 资源估算

### 时间估算
- **阶段2（采样器改进）**：11-15 小时
- **阶段3（透明度支持）**：5-6 小时
- **总计**：16-21 小时

### 技术栈
- **前端框架**：Vue 3 + TypeScript
- **UI 库**：daisyUI + Tailwind CSS
- **状态管理**：Pinia
- **音乐库**：Tonal.js + smplr
- **构建工具**：Vite

---

## 🎯 成功指标

### 功能性指标
- [ ] 所有 bug 已修复
- [ ] 所有新功能正常工作
- [ ] 类型检查通过（`npm run type-check`）
- [ ] 无控制台错误

### 代码质量指标
- [ ] 代码复用率提高（通过工具函数）
- [ ] 组件可测试性提高
- [ ] 文档完整（需求文档 + 实施计划 + ADR）

### 用户体验指标
- [ ] 页面加载速度正常
- [ ] 交互响应流畅
- [ ] 错误提示清晰
- [ ] 缓存管理直观

---

## 🚨 风险与缓解

### 风险1：颜色选择器库选择不当
- **影响**：透明度功能无法实现或性能问题
- **缓解**：
  1. 先评估多个库的性能和功能
  2. 准备备选方案（自定义实现）
  3. 先在单个组件中测试

### 风险2：缓存清除导致数据丢失
- **影响**：用户需要重新下载所有音源
- **缓解**：
  1. 添加确认对话框
  2. 显示缓存大小提醒
  3. 提供"仅清除未使用的音源"选项

### 风险3：布局重构影响现有功能
- **影响**：采样器页面功能异常
- **缓解**：
  1. 分步重构，每步测试
  2. 保持组件 API 兼容
  3. 使用 feature flag 控制新布局

---

## 📝 下一步行动

### 立即开始
1. **创建 SamplerNavbar 组件**（任务5.1.1）
2. **重构 SamplerSidebar 组件**（任务5.1.2）

### 等待确认
- 是否继续处理阶段2？
- 是否需要调整优先级？
- 是否有其他需求？

---

## 📚 相关文档

- [任务需求文档](./TASK_REQUIREMENTS.md)
- [CONTEXT.md](../CONTEXT.md)（如果存在）
- [项目架构文档](../README.md)（如果存在）