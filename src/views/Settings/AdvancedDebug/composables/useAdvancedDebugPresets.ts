import { ref, watch } from "vue";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { createLogger } from "@/utils/logger";
import type { Settings } from "@/types";
import type { WaterfallPianoSettings } from "@/views/WaterfallPiano/types";

const logger = createLogger("AdvancedDebugPresets");

const PRESETS_STORAGE_KEY = "midi-jar-advanced-debug-presets";

/** 高级调试预设快照：保存某一时刻的 Notation + WaterfallPiano 配置 */
export interface AdvancedDebugPreset {
  /** 预设名称（用户输入） */
  name: string;
  /** 创建时间戳（毫秒） */
  createdAt: number;
  /** 备注（可选） */
  description?: string;
  /** Notation 段配置快照 */
  notation: Settings["notation"];
  /** WaterfallPiano 完整设置快照 */
  waterfall: WaterfallPianoSettings;
}

/** 预设列表加载结果 */
interface PresetListResult {
  presets: AdvancedDebugPreset[];
}

/**
 * 高级调试预设管理 composable
 *
 * 职责：
 * 1. 从 localStorage 加载/保存预设列表
 * 2. 创建新预设（捕获当前 settings + waterfall 配置）
 * 3. 应用预设（覆盖当前 settings + waterfall 配置）
 * 4. 重命名/删除预设
 * 5. 导出预设为 JSON 文件，导入 JSON 文件为预设
 *
 * 预设数据结构稳定后可考虑版本化，目前无版本字段，向后兼容靠 mergeDeep。
 */
export function useAdvancedDebugPresets(options: {
  getNotation: () => Settings["notation"];
  setNotation: (notation: Settings["notation"]) => void;
  getWaterfall: () => WaterfallPianoSettings;
  setWaterfall: (settings: WaterfallPianoSettings) => void;
}) {
  const { getNotation, setNotation, getWaterfall, setWaterfall } = options;

  const presets = ref<AdvancedDebugPreset[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /** 从 localStorage 加载预设列表 */
  function loadPresets(): void {
    isLoading.value = true;
    error.value = null;
    try {
      const result = loadFromStorage<PresetListResult>({
        key: PRESETS_STORAGE_KEY,
        defaultValue: { presets: [] },
      });
      presets.value = Array.isArray(result.presets)
        ? result.presets
        : ([] as AdvancedDebugPreset[]);
    } catch (e) {
      logger.error({ err: e }, "Failed to load presets");
      error.value = "Failed to load presets";
      presets.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  /** 持久化预设列表到 localStorage */
  function persistPresets(): void {
    try {
      saveToStorage(PRESETS_STORAGE_KEY, { presets: presets.value });
    } catch (e) {
      logger.error({ err: e }, "Failed to persist presets");
      error.value = "Failed to save presets";
    }
  }

  /**
   * 保存当前配置为新预设
   * @param name - 预设名称
   * @param description - 备注（可选）
   * @returns 是否保存成功（名称非空且不重复）
   */
  function savePreset(name: string, description?: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) {
      error.value = "Preset name cannot be empty";
      return false;
    }
    if (presets.value.some((p) => p.name === trimmed)) {
      error.value = "Preset name already exists";
      return false;
    }
    const preset: AdvancedDebugPreset = {
      name: trimmed,
      createdAt: Date.now(),
      description: description?.trim() || undefined,
      notation: structuredClone(getNotation()),
      waterfall: structuredClone(getWaterfall()),
    };
    presets.value = [...presets.value, preset].sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
    persistPresets();
    logger.info(`Saved preset: ${trimmed}`);
    return true;
  }

  /**
   * 应用指定预设到当前配置
   * @param name - 预设名称
   * @returns 是否应用成功
   */
  function applyPreset(name: string): boolean {
    const preset = presets.value.find((p) => p.name === name);
    if (!preset) {
      error.value = `Preset "${name}" not found`;
      return false;
    }
    try {
      setNotation(structuredClone(preset.notation));
      setWaterfall(structuredClone(preset.waterfall));
      logger.info(`Applied preset: ${name}`);
      error.value = null;
      return true;
    } catch (e) {
      logger.error({ err: e }, `Failed to apply preset: ${name}`);
      error.value = `Failed to apply preset: ${name}`;
      return false;
    }
  }

  /**
   * 重命名预设
   * @param oldName - 旧名称
   * @param newName - 新名称
   */
  function renamePreset(oldName: string, newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed) {
      error.value = "Preset name cannot be empty";
      return false;
    }
    if (presets.value.some((p) => p.name === trimmed)) {
      error.value = "Preset name already exists";
      return false;
    }
    const idx = presets.value.findIndex((p) => p.name === oldName);
    if (idx < 0) {
      error.value = `Preset "${oldName}" not found`;
      return false;
    }
    presets.value = presets.value.map((p, i) =>
      i === idx ? { ...p, name: trimmed } : p,
    );
    persistPresets();
    return true;
  }

  /**
   * 删除预设
   * @param name - 预设名称
   */
  function deletePreset(name: string): boolean {
    const idx = presets.value.findIndex((p) => p.name === name);
    if (idx < 0) return false;
    presets.value = presets.value.filter((_, i) => i !== idx);
    persistPresets();
    logger.info(`Deleted preset: ${name}`);
    return true;
  }

  /**
   * 导出全部预设为 JSON 文件（触发浏览器下载）
   * @param filename - 文件名（不含扩展名）
   */
  function exportPresets(filename = "advanced-debug-presets"): void {
    try {
      const data = JSON.stringify(
        { version: 1, exportedAt: Date.now(), presets: presets.value },
        null,
        2,
      );
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logger.info(`Exported ${presets.value.length} presets`);
    } catch (e) {
      logger.error({ err: e }, "Failed to export presets");
      error.value = "Failed to export presets";
    }
  }

  /**
   * 从 JSON 文件导入预设
   * @param file - 用户选择的 JSON 文件
   * @param mode - 导入模式："merge" 合并（保留现有），"replace" 替换（清空现有）
   * @returns 导入的预设数量
   */
  async function importPresets(
    file: File,
    mode: "merge" | "replace" = "merge",
  ): Promise<number> {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as
        | AdvancedDebugPreset[]
        | { presets?: AdvancedDebugPreset[] };

      const incoming: AdvancedDebugPreset[] = Array.isArray(parsed)
        ? parsed
        : parsed.presets ?? [];

      if (mode === "replace") {
        presets.value = incoming;
      } else {
        // 合并：跳过同名预设
        const existing = new Set(presets.value.map((p) => p.name));
        const merged = [
          ...presets.value,
          ...incoming.filter((p) => !existing.has(p.name)),
        ].sort((a, b) =>
          a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
        );
        presets.value = merged;
      }
      persistPresets();
      logger.info(`Imported ${incoming.length} presets (${mode})`);
      error.value = null;
      return incoming.length;
    } catch (e) {
      logger.error({ err: e }, "Failed to import presets");
      error.value = "Invalid JSON file or format";
      return 0;
    }
  }

  /** 清空错误状态 */
  function clearError(): void {
    error.value = null;
  }

  // 初始加载
  loadPresets();

  // 监听错误自动清除
  watch(error, (val) => {
    if (val) {
      setTimeout(() => {
        if (error.value === val) error.value = null;
      }, 5000);
    }
  });

  return {
    presets,
    isLoading,
    error,
    loadPresets,
    savePreset,
    applyPreset,
    renamePreset,
    deletePreset,
    exportPresets,
    importPresets,
    clearError,
  };
}
