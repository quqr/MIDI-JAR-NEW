/**
 * VST3 宿主的面向前端的数据契约。
 *
 * 与 Rust 侧 `src-tauri/src/vst/scan.rs`、`src-tauri/src/vst/host.rs` 的
 * `#[serde(rename_all = "camelCase")]` 结构一一对应；两边任何一侧改字段都需要同步。
 */

/** 音源来源：内置采样器 / 外部 VST3 插件。单一决策源在前端。 */
export type ToneSource = "sampler" | "vst";

/** 单个扫描成功的插件。 */
export interface ScannedPlugin {
  /** `.vst3` bundle 绝对路径，同时是实例的唯一标识 */
  path: string;
  /** 展示名 */
  name: string;
  /** 厂商名 */
  vendor: string;
  /** 版本字符串，可能为空 */
  version: string;
  /** 子类别，如 `Instrument|Synth` */
  category: string;
  /** VST3 class uid（32 位 hex） */
  uid: string;
  /** 音频输入总线数 */
  audioInputs: number;
  /** 音频输出总线数 */
  audioOutputs: number;
  /** 是否有事件（MIDI）输入总线——本应用的音源必须为 true */
  hasMidiInput: boolean;
  /** 是否有事件（MIDI）输出总线 */
  hasMidiOutput: boolean;
  /** 是否提供编辑器 */
  hasGui: boolean;
}

/** 被跳过的插件，原因可展示给用户。 */
export interface SkippedPlugin {
  /** 插件路径 */
  path: string;
  /** 机器可读的原因分类 */
  reason: "crashed" | "timedOut" | "failed";
  /** 人类可读的补充说明（崩溃退出码、错误详情） */
  detail: string | null;
}

/** 一次完整扫描的产物。 */
export interface VstScanCache {
  /** 本次扫描实际使用的目录列表 */
  paths: string[];
  /** 扫描成功的插件 */
  plugins: ScannedPlugin[];
  /** 被跳过的插件 */
  skipped: SkippedPlugin[];
  /**
   * 扫描没能跑起来时的原因（探针二进制缺失等）。
   * 非 null 时 `plugins` 必然为空，且**不能**展示为“没有装插件”。
   */
  error: string | null;
  /** 扫描完成的 Unix 毫秒时间戳 */
  scannedAt: number;
}

/** `vst:status` 事件与 `get_vst_status` 里的状态机载荷。 */
export interface VstStatusPayload {
  state: "empty" | "running" | "error";
  /** 仅 state === "error" 时有值 */
  message: string | null;
}

/** 已加载插件的信息（`get_vst_status` 的 `plugin` 字段）。 */
export interface VstPluginInfo {
  path: string;
  name: string;
  vendor: string;
  editorOpen: boolean;
  audioRunning: boolean;
}

/** `get_vst_status` 的返回形状。 */
export interface VstSnapshot {
  status: VstStatusPayload;
  plugin: VstPluginInfo | null;
}

/** `vst:scan-progress` 事件载荷（只有起止两相，无细粒度进度）。 */
export interface VstScanProgress {
  phase: "started" | "done";
  /** 已完成的插件数；phase === "done" 时等于总数 */
  count: number;
}

/** 持久化在 `midi-jar-vst-state` 里的形状。 */
export interface VstPersistedState {
  /** 上次加载的插件路径 */
  selectedPluginPath: string | null;
  /** 用户自定义扫描目录 */
  customScanPaths: string[];
  /** 上次扫描完成时间（Unix 毫秒） */
  scannedAt: number | null;
}
