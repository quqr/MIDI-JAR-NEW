import type {
  ScannedPlugin,
  SkippedPlugin,
  ToneSource,
  VstPluginInfo,
  VstStatusPayload,
} from "@/types/vst";

/**
 * VST 页面三个子组件的 Props 契约。
 *
 * 组件是展示型的：数据一律 props 进、事件 emit 出，store 只在
 * `Vst.vue`（容器）里消费；唯一的例外是 `isPluginUsable` 这类纯谓词，
 * 子组件经 store 引用而不产生状态耦合。
 */

/** `VstStatusPanel` 的输入。 */
export interface VstStatusPanelProps {
  /** 当前音源来源 */
  toneSource: ToneSource;
  /** 音源来源选项（含 i18n 文案），顺序即滑条档位顺序（none/sampler/vst） */
  toneSourceOptions: { value: ToneSource; label: string }[];
  /** 宿主状态机载荷（`vst:status` 的形状） */
  status: VstStatusPayload;
  /** 已加载插件信息（running 时非 null） */
  pluginInfo: VstPluginInfo | null;
  /** 是否有插件正在加载（列表项/中区的 loading 态） */
  isLoading: boolean;
  /** 是否有选中的插件（含未加载成功）——重载/卸载按钮的禁用依据 */
  hasSelection: boolean;
}

/** `VstPluginLibrary` 的输入。 */
export interface VstPluginLibraryProps {
  /** 扫描成功的插件列表 */
  plugins: ScannedPlugin[];
  /** 当前选中的插件路径（未必已加载成功） */
  selectedPluginPath: string | null;
  /** 正在加载的插件路径（列表项 loading 态） */
  loadingPluginPath: string | null;
  /** 宿主是否处于 running（选中项的"运行中"标记） */
  isRunning: boolean;
  /** 是否正在扫描 */
  isScanning: boolean;
  /** 扫描器本身失败的原因——区别于"没有装插件" */
  scanError: string | null;
  /** 最近一次加载失败的详情（列表项与详情区内联展示） */
  loadError: { path: string; message: string } | null;
}

/** `VstScanSettings` 的输入。 */
export interface VstScanSettingsProps {
  /** 扫描时被跳过的插件（崩溃/超时/失败） */
  skipped: SkippedPlugin[];
  /** 用户自定义扫描目录 */
  customScanPaths: string[];
  /** 正在等待系统目录选择对话框 */
  isAddingPath: boolean;
  /** 已格式化的上次扫描时间；空串表示从未扫描 */
  formattedScannedAt: string;
}
