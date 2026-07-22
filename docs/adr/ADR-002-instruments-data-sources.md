# ADR-002: instruments.json 音源数据来源（smplr + smpldsnds）

## Status

Accepted

## Context

`src/data/instruments.json` 是 GM（General MIDI）乐器注册表：每个乐器通过 `factory` 字段引用一个 smplr 采样源，播放代码 `src/composables/useSamplerService.ts` 据此 switch 构建对应乐器实例。

原文件存在两个数据完整性问题：

1. **`sources.smplr.factories` 是手写且不完整的**。经爬取 `danigb/smplr` 源码（`src/` 下各乐器模块）确认，smplr v1.0 实际导出 **11** 个乐器模块，而原文件只列了 9 个，漏掉了 `soundfont2`（读取 .sf2 文件）和 `sampler`（自定义 buffer / SFZ 预设）。
2. **对 `smpldsnds` 毫无感知**。smplr 本身只是播放器，所有原始采样文件实际托管在 GitHub 组织 `smpldsnds`（通过 GitHub Pages 提供），共 **19** 个采样仓库，各有不同许可证（CC0 / Public Domain / GPL / 混合等）。原文件把 smpldsnds 仅写为 smplr 的一条 url，丢失了仓库级细节。

数据来源（2026-07-22 爬取）：
- `https://github.com/danigb/smplr`（README + `git/trees/HEAD?recursive=1` 源码树）
- `https://github.com/smpldsnds`（组织 profile README，逐仓库描述与许可证）

## Decision

1. **补全 `sources.smplr.factories` 至真实 11 个乐器**，保留原有 9 个 `id` 不变（确保 `instruments` 引用不断链），新增 `soundfont2` 与 `sampler`。每个 factory 记录 `id / name / description / helper`（helper 为对应的 `getXxxNames()` 辅助函数，自定义类为 `null`）。
2. **新增 `sources.smpldsnds` 顶层条目**，沿用与 `smplr` 相同的 `{ version, url, list }` 结构（factories ↔ sampleRepos），逐条收录 19 个采样仓库：`id / name / description / license / url / backs`（`backs` 指该仓库实际支撑的 smplr factory `id` 列表；无直接对应工厂者留空数组）。
3. **`instruments`（128 个 GM 程序 + 1 个鼓组）与 `categories` 保持不变**，以不影响 `useSamplerService.ts` 的 switch 播放逻辑。

### 结构示意

```
sources
├── smplr       { version, url, factories[ {id,name,description,helper} ] }      // 播放器层
└── smpldsnds   { version, url, description, sampleRepos[ {id,name,license,url,backs} ] }  // 采样托管层
```

## Consequences

- 数据现在同时描述「播放器（smplr）」与「采样托管（smpldsnds）」两层，可追溯每个 factory 背后真实采样仓库与许可证。
- 校验通过：19 个 `backs` 全部指向真实 factory；129 个 `instruments` 引用的 factory 全部存在，无断链。
- 新增字段（`smplr.factories[].helper`、`smpldsnds.sampleRepos[].license/backs`）为纯元数据，当前消费代码（`sampler.ts` / `useSamplerService.ts`）不读取，向后兼容。
- 未触碰 `instruments` 数组，播放行为零风险。

## Alternatives Considered

- **把 smpldsnds 仓库嵌入各 smplr factory 内部**（加 `sampleRepos`/`hostedBy`）：被否决——19 个仓库中有多个并非 smplr factory（如 `supersaw`、`wavedit-online`），强行嵌入会产生空引用、冗余高。
- **仅把 smpldsnds 作为宿主 URL 注记**：被否决——丢失仓库级许可证与 `backs` 映射，信息价值低。
- **同时细化 `instruments` 映射（把更多 GM 程序指向采样源 / 新增非 GM 乐器）**：被否决（本次不做）——需同步修改 `useSamplerService.ts` 的 switch 与新工厂支持，超出「更新数据」范围，留待后续独立任务。
