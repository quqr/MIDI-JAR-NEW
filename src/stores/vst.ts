import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getTauriAPI, isTauri } from "@/utils/tauri";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { createLogger } from "@/utils/logger";
import type {
  ScannedPlugin,
  SkippedPlugin,
  VstPersistedState,
  VstPluginInfo,
  VstStatusPayload,
} from "@/types/vst";

const VST_STORAGE_KEY = "midi-jar-vst-state";

const logger = createLogger("vst");

/** 默认的 VST 持久化状态 */
const DEFAULT_VST_STATE: VstPersistedState = {
  selectedPluginPath: null,
  customScanPaths: [],
  scannedAt: null,
};

export const useVstStore = defineStore("vst", () => {
  // ─── State ───

  // 注意：toneSource 的单一决策源在 `stores/sampler.ts`（持久化也在那边），
  // 这里**不要**再建第二份副本——曾因双份状态差一点分叉。

  /** 扫描到的可用插件 */
  const plugins = ref<ScannedPlugin[]>([]);
  /** 扫描时被跳过的插件（崩溃/超时/失败） */
  const skipped = ref<SkippedPlugin[]>([]);
  /** 扫描本身没能跑起来的原因（目录枚举失败等）——区别于“没有装插件” */
  const scanError = ref<string | null>(null);
  /** 上次扫描完成时间（Unix 毫秒） */
  const scannedAt = ref<number | null>(null);
  /** 是否正在扫描 */
  const isScanning = ref(false);
  /** 扫描进度阶段 */
  const scanPhase = ref<"idle" | "started" | "done">("idle");
  /** 扫描进度计数（done 阶段是插件总数） */
  const scanCount = ref(0);

  /** 用户自定义扫描目录 */
  const customScanPaths = ref<string[]>([]);
  /** 后端实际生效的目录列表（标准目录 + 自定义，去重后） */
  const effectiveScanPaths = ref<string[]>([]);

  /** 当前选中的插件路径（未必已加载成功） */
  const selectedPluginPath = ref<string | null>(null);
  /** 正在加载的插件路径（用于列表项 loading 态） */
  const loadingPluginPath = ref<string | null>(null);

  /** 宿主状态机 */
  const status = ref<VstStatusPayload>({ state: "empty", message: null });
  /** 已加载插件信息 */
  const pluginInfo = ref<VstPluginInfo | null>(null);
  /** 最近一次加载失败（用于列表项内联错误） */
  const loadError = ref<{ path: string; message: string } | null>(null);

  // ─── 持久化（与 toneSource 分离：toneSource 归 sampler store） ───
  const saved = loadFromStorage<VstPersistedState>({
    key: VST_STORAGE_KEY,
    defaultValue: DEFAULT_VST_STATE,
    mergeWithDefault: true,
  });
  if (saved.selectedPluginPath) {
    selectedPluginPath.value = saved.selectedPluginPath;
  }
  if (Array.isArray(saved.customScanPaths)) {
    customScanPaths.value = [...saved.customScanPaths];
  }
  if (typeof saved.scannedAt === "number") {
    scannedAt.value = saved.scannedAt;
  }

  function persist() {
    saveToStorage<VstPersistedState>(VST_STORAGE_KEY, {
      selectedPluginPath: selectedPluginPath.value,
      customScanPaths: customScanPaths.value,
      scannedAt: scannedAt.value,
    });
  }

  // ─── Getters ───

  /** 已加载且正在运行 */
  const isRunning = computed(() => status.value.state === "running");
  /** 处于显式错误态（崩溃/加载失败） */
  const hasError = computed(() => status.value.state === "error");
  /** 错误提示文案 */
  const errorMessage = computed(() => status.value.message);

  /**
   * 扫描已完成（非错误）但一个插件都没找到。
   *
   * 此时"音源选择 = vst"与"实际可用性"脱节：列表为空、自动加载的持久化
   * 路径未必有效。UI 据此明确提示空态，并禁用"切到 VST 就自动加载"的入口，
   * 而不是让用户面对一个显示"运行中"却无法从列表选择的界面。
   */
  const hasScannedAndEmpty = computed(
    () =>
      scannedAt.value !== null &&
      !isScanning.value &&
      scanError.value === null &&
      plugins.value.length === 0,
  );

  /** 路径 → 插件信息（O(1) 查找，供列表渲染补 vendor 等） */
  const pluginByPath = computed(() => {
    const map = new Map<string, ScannedPlugin>();
    for (const p of plugins.value) map.set(p.path, p);
    return map;
  });

  /** 路径 → 跳过原因（O(1) 查找） */
  const skippedByPath = computed(() => {
    const map = new Map<string, SkippedPlugin>();
    for (const s of skipped.value) map.set(s.path, s);
    return map;
  });

  /** 当前选中的插件对象 */
  const selectedPlugin = computed<ScannedPlugin | null>(() => {
    if (!selectedPluginPath.value) return null;
    return pluginByPath.value.get(selectedPluginPath.value) ?? null;
  });

  /**
   * 扫描结果里没有 MIDI 输入总线的插件无法作为音源，应标记为禁用。
   * 这比“加载后才报错”更早暴露问题。
   */
  function isPluginUsable(p: ScannedPlugin): boolean {
    return p.hasMidiInput && p.audioOutputs > 0;
  }

  // ─── Actions ───

  function applyStatus(next: VstStatusPayload) {
    status.value = next;
    if (next.state !== "running") {
      // 进入 empty / error 后不再保留插件信息
      pluginInfo.value = null;
    }
  }

  /** 从后端同步一次状态（进入页面时调用） */
  async function refreshStatus(): Promise<void> {
    if (!isTauri()) return;
    try {
      const snapshot = await getTauriAPI().vst.getStatus();
      applyStatus(snapshot.status);
      pluginInfo.value = snapshot.plugin;
    } catch (err) {
      logger.warn("[vst] refreshStatus failed: %s", err);
    }
  }

  /**
   * 用持久化的自定义目录初始化后端，并取回生效目录列表。
   * 应在启动时（扫描之前）调用一次。
   */
  async function restoreScanPaths(): Promise<void> {
    if (!isTauri()) return;
    try {
      effectiveScanPaths.value = await getTauriAPI().vst.restoreScanPaths(
        customScanPaths.value,
      );
    } catch (err) {
      logger.warn("[vst] restoreScanPaths failed: %s", err);
    }
  }

  /** 读取后端缓存（不触发扫描），用于首屏秒显 */
  async function loadCachedScan(): Promise<boolean> {
    if (!isTauri()) return false;
    try {
      const cache = await getTauriAPI().vst.getScanCache();
      if (!cache) return false;
      applyScanCache(cache);
      return true;
    } catch (err) {
      logger.warn("[vst] loadCachedScan failed: %s", err);
      return false;
    }
  }

  function applyScanCache(cache: {
    paths: string[];
    plugins: ScannedPlugin[];
    skipped: SkippedPlugin[];
    error: string | null;
    scannedAt: number;
  }) {
    plugins.value = cache.plugins;
    skipped.value = cache.skipped;
    scanError.value = cache.error;
    scannedAt.value = cache.scannedAt;
    if (cache.paths.length > 0) {
      effectiveScanPaths.value = cache.paths;
    }
    persist();
  }

  /** 扫描全部插件（重活；结果写入后端缓存并由返回值带回） */
  async function scan(): Promise<void> {
    if (!isTauri() || isScanning.value) return;
    isScanning.value = true;
    try {
      const cache = await getTauriAPI().vst.scan();
      applyScanCache(cache);
      logger.info(
        "[vst] scan done: %d plugins, %d skipped, error=%s",
        cache.plugins.length,
        cache.skipped.length,
        cache.error,
      );
    } catch (err) {
      scanError.value = err instanceof Error ? err.message : String(err);
      logger.error("[vst] scan failed: %s", err);
    } finally {
      isScanning.value = false;
    }
  }

  /** 添加自定义扫描目录（后端去重后返回完整列表） */
  async function addScanPath(path: string): Promise<void> {
    if (!isTauri()) return;
    const normalized = path.trim();
    if (!normalized) return;
    if (customScanPaths.value.includes(normalized)) return;
    try {
      const api = getTauriAPI();
      customScanPaths.value = [...customScanPaths.value, normalized];
      effectiveScanPaths.value = await api.vst.addScanPath(normalized);
      persist();
    } catch (err) {
      // 后端拒绝（路径不存在等）→ 回滚本地乐观更新
      customScanPaths.value = customScanPaths.value.filter(
        (p) => p !== normalized,
      );
      logger.warn("[vst] addScanPath failed: %s", err);
      throw err;
    }
  }

  /** 移除自定义扫描目录 */
  async function removeScanPath(path: string): Promise<void> {
    if (!isTauri()) return;
    try {
      effectiveScanPaths.value = await getTauriAPI().vst.removeScanPath(path);
      customScanPaths.value = customScanPaths.value.filter((p) => p !== path);
      persist();
    } catch (err) {
      logger.warn("[vst] removeScanPath failed: %s", err);
    }
  }

  /**
   * 选择并加载插件。
   *
   * 失败时后端已把状态置为 error 并广播 `vst:status`，这里额外记录到列表项上，
   * 便于就地显示错误（而非仅靠全局提示）。
   */
  async function selectPlugin(path: string, openEditor = true): Promise<void> {
    if (!isTauri()) return;
    selectedPluginPath.value = path;
    loadingPluginPath.value = path;
    loadError.value = null;
    persist();

    try {
      await getTauriAPI().vst.load(path, openEditor);
      await refreshStatus();
    } catch (err) {
      loadError.value = {
        path,
        message: err instanceof Error ? err.message : String(err),
      };
      await refreshStatus();
      throw err;
    } finally {
      loadingPluginPath.value = null;
    }
  }

  /** 卸载当前插件 */
  async function unload(): Promise<void> {
    if (!isTauri()) return;
    try {
      await getTauriAPI().vst.unload();
      await refreshStatus();
    } catch (err) {
      logger.warn("[vst] unload failed: %s", err);
    }
  }

  /** 错误态下重新加载当前插件 */
  async function reload(): Promise<void> {
    if (!selectedPluginPath.value) return;
    const path = selectedPluginPath.value;
    await unload();
    await selectPlugin(path, true);
  }

  /** 打开/关闭编辑器 */
  async function openEditor(): Promise<void> {
    if (!isTauri()) return;
    try {
      await getTauriAPI().vst.openEditor();
      await refreshStatus();
    } catch (err) {
      logger.warn("[vst] openEditor failed: %s", err);
    }
  }

  async function closeEditor(): Promise<void> {
    if (!isTauri()) return;
    try {
      await getTauriAPI().vst.closeEditor();
      await refreshStatus();
    } catch (err) {
      logger.warn("[vst] closeEditor failed: %s", err);
    }
  }

  /** 发送原始 MIDI 字节（供 useSamplerService 调用，静默失败） */
  async function sendMidi(bytes: number[]): Promise<void> {
    if (!isTauri()) return;
    try {
      await getTauriAPI().vst.sendMidi(bytes);
    } catch (err) {
      logger.error("[vst] sendMidi failed: %s", err);
    }
  }

  // ─── 事件订阅（幂等） ───
  let unlistenStatus: (() => void) | null = null;
  let unlistenScan: (() => void) | null = null;

  async function subscribeEvents(): Promise<void> {
    if (!isTauri()) return;
    if (unlistenStatus) return;

    const api = getTauriAPI();
    unlistenStatus = await api.vst.onStatus((payload) => {
      applyStatus(payload);
      if (payload.state === "running") {
        void refreshStatus();
      }
    });
    unlistenScan = await api.vst.onScanProgress((progress) => {
      scanPhase.value = progress.phase;
      scanCount.value = progress.count;
    });
  }

  function disposeEvents() {
    unlistenStatus?.();
    unlistenScan?.();
    unlistenStatus = null;
    unlistenScan = null;
  }

  return {
    // state
    plugins,
    skipped,
    scanError,
    scannedAt,
    isScanning,
    scanPhase,
    scanCount,
    customScanPaths,
    effectiveScanPaths,
    selectedPluginPath,
    loadingPluginPath,
    status,
    pluginInfo,
    loadError,
    // getters
    isRunning,
    hasError,
    errorMessage,
    hasScannedAndEmpty,
    pluginByPath,
    skippedByPath,
    selectedPlugin,
    isPluginUsable,
    // actions
    refreshStatus,
    restoreScanPaths,
    loadCachedScan,
    scan,
    addScanPath,
    removeScanPath,
    selectPlugin,
    unload,
    reload,
    openEditor,
    closeEditor,
    sendMidi,
    subscribeEvents,
    disposeEvents,
  };
});
