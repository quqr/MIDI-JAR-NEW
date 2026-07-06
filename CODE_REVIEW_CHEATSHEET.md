# 🃏 代码审查速查卡

> 快速参考，适合打印贴在工位或 Slack 置顶

---

## 🔴 Blocker · 必须修复

| 检查点 | 常见表现 |
|--------|----------|
| 安全漏洞 | `v-html`、`innerHTML`、SQL 拼接、文件路径注入 |
| 数据风险 | 未确认的删除/覆盖、缺少回滚 |
| 逻辑错误 | 条件反了、边界遗漏、竞态条件 |
| API 破坏 | 修改接口签名未通知调用方 |
| 资源泄漏 | 未 `clearTimeout`、未 `disconnect` ResizeObserver |
| 并发问题 | 异步时序依赖、共享状态未保护 |

## 🟡 Suggestion · 建议修复

| 检查点 | 常见表现 |
|--------|----------|
| 输入验证 | MIDI 值超出 0-127、空数组未处理 |
| 可读性 | 魔法数字、嵌套过深、模糊命名 |
| 代码重复 | 相似逻辑 3+ 处，应提取工具函数 |
| 测试缺失 | 新增逻辑无对应测试 |
| 性能 | 不必要的响应式计算、高频重渲染 |
| 类型安全 | 滥用 `any`、`as`、非空断言 `!` |
| 错误处理 | catch 为空、Promise 未 catch |

## 💭 Nit · 锦上添花

- 命名微调、注释补充、导入顺序、日志改进

---

## Vue 组件重点

```
🔴 v-html?    → XSS 风险
🔴 v-for key? → 正确使用 key
🔴 props 默认值? → withDefaults
🔴 emit 类型? → defineEmits<{}>
🟡 组件太大? → 拆子组件
🟡 computed 有副作用? → 应是纯函数
🟡 watch deep/immediate 合理?
```

## TypeScript 重点

```
🔴 显式 any?           → 换 unknown + 守卫
🔴 非空断言 obj!.prop? → 更安全写法
🔴 as 安全?             → 避免 as any 链条
🔴 await 了吗?          → 异步函数返回值
```

## 提交前自测

```bash
npm run type-check   # TypeScript
npm run lint         # ESLint
npm run test -- run  # 单元测试
npm run build        # 构建
```

## 审查流程速览

```
PR 创建 → 自动化检查 → 指定审查人 → Review
→ Blocker? → 修复重审 → Suggestion? → 可选处理
→ 批准 → Squash merge → 删分支
```

## Commit Message 格式

```
<type>(<scope>): <描述>

feat/fix/refactor/perf/test/docs/style/chore/types
```

## PR 最佳习惯

| ✅ 做 | ❌ 不做 |
|-------|--------|
| 小 PR（< 500 行） | 大 PR（> 1000 行） |
| 一个 PR 一个主题 | 混合无关变更 |
| 写清楚 PR 描述 | 不写描述 |
| 附上测试 | 纯手测 |
| 回复每条评论 | 沉默不回应 |
