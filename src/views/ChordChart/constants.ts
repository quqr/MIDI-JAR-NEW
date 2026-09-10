/**
 * 和弦谱编辑器（Chord Chart Editor）常量。
 *
 * 持久化与布局的单一事实源；领域类型见 ./domain/types.ts。
 */

/** 曲库索引存储键 */
export const LIBRARY_STORAGE_KEY = "midi-jar-chord-charts-index";

/** 单曲数据存储键前缀（完整键 = `${CHART_STORAGE_PREFIX}${id}`） */
export const CHART_STORAGE_PREFIX = "midi-jar-chord-chart-";

/** 编辑器偏好存储键 */
export const EDITOR_SETTINGS_STORAGE_KEY = "midi-jar-chord-chart-settings";

/** 单曲数据结构版本（用于后续迁移） */
export const CHART_FORMAT_VERSION = 1;

/** 编辑器偏好版本 */
export const EDITOR_SETTINGS_VERSION = 1;

/** 导入导出文件扩展名 */
export const CHART_FILE_EXTENSION = ".mjchart";

/**
 * 一条 system 的 cell 数（iReal 约定：16 cell / system）。
 * 小节永不跨行——由 layoutSystems 的贪心装箱保证。
 */
export const CELLS_PER_SYSTEM = 16;

/** 一页的 system 数（仅渲染分页参考，模型不强制） */
export const SYSTEMS_PER_PAGE = 12;

/** 单曲小节数上限（iReal：12 system × 4 小节，宽松给到 96 小节） */
export const MAX_MEASURES = 96;

/**
 * 和弦时长的内部精度：以「半拍」为单位存整数，避免 1.5 拍的浮点误差。
 * 1 拍 = 2、1.5 拍 = 3、2 拍 = 4、3 拍 = 6、4 拍 = 8。
 */
export const HALF_BEATS_PER_BEAT = 2;

/** 允许的和弦时长（单位：拍），UI 按钮组用 */
export const CHORD_BEAT_OPTIONS = [1, 1.5, 2, 3, 4] as const;

/** 默认速度 */
export const DEFAULT_TEMPO = 120;

/** 速度范围（BPM） */
export const TEMPO_RANGE = { min: 20, max: 400, step: 1 } as const;

/** 整体重复次数范围 */
export const REPEATS_RANGE = { min: 1, max: 12, step: 1 } as const;

/** 自动保存防抖时长（毫秒） */
export const AUTOSAVE_DEBOUNCE_MS = 500;

/** 撤销/重做快照上限 */
export const MAX_UNDO_DEPTH = 100;

/** 小节内书写文字的长度上限 */
export const MAX_MEASURE_TEXT_LENGTH = 64;

/** 曲库索引中标题的截断长度 */
export const LIBRARY_TITLE_MAX_LENGTH = 64;
