# 术语表：instruments.json 音源数据

> 配合 `src/data/instruments.json` 与 `docs/adr/ADR-002-instruments-data-sources.md` 使用。

## 核心概念

- **GM（General MIDI）**：通用 MIDI 规范，定义 128 个标准乐器程序号（Program 0–127）。`instruments.json` 的 `instruments` 数组即按此编号逐一映射。
- **`instruments`**：GM 乐器注册表。每条含 `id / name / gmProgram / category / factory / factoryOptions`。其中 `factory` 指向 `sources.smplr.factories` 的某个 `id`。
- **`factory`（工厂 / 采样源）**：smplr 中一种可实例化的乐器类型（如 `Soundfont`、`SplendidGrandPiano`）。播放代码 `useSamplerService.ts` 通过 switch 对 `factory` 值构造对应实例。
- **`factoryOptions`**：传给工厂构造器的额外参数，典型为 `{ "instrument": "CP80" }`，用于在同一 factory 内选择具体音色。

## 两层数据来源

- **`smplr`**（`danigb/smplr`）：Web Audio 采样**播放器库**（v1.0）。本身是「容器」，不持有音频文件，仅定义 11 个乐器模块。
  - `helper`：对应 `getXxxNames()` 辅助函数，返回该工厂可用音色名列表（用于 `instrument` 选项）；自定义类（`soundfont2` / `sampler`）为 `null`。
  - 11 个 factory：`soundfont`、`soundfont2`、`sampler`、`splendid-grand-piano`、`electric-piano`、`drum-machine`、`drum-abuse`、`mallet`、`mellotron`、`smolken`、`versilian`。
- **`smpldsnds`**（`github.com/smpldsnds`）：**采样托管组织**。所有 smplr 加载的原始音频实际存放于此（GitHub Pages 提供），共 19 个仓库。
  - `sampleRepos`：smpldsnds 下的采样仓库清单。
  - `license`：仓库许可证（CC0 / Public Domain / GPLv2+ / GPLv3 / 混合 / 未知 等）。
  - `backs`：该采样仓库实际支撑的 smplr factory `id` 列表；无直接对应工厂者为 `[]`。

## 其它

- **Soundfont**：合成器/采样器使用的音色文件格式；此处指 smplr 的 GM 通用音色回退源（默认 `MusyngKite` / `FluidR3_GM`）。
- **VCSL**：Versilian Community Sample Library（社区采样库），支撑 `mallet` 与 `versilian` 两个 factory。
- **Drum Abuse**：Synthabuse 鼓机集合，约 210 台机器、分 5 个 pack（vol1–vol5），对应 `drum-abuse` factory。
- **`$schema`**：文件头指向 `./instruments.schema.json`，但该 schema 文件当前不存在（悬空引用），运行时无校验；新增字段不触发校验失败。
