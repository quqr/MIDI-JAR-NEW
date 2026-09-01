import { ref, shallowRef, type Ref } from "vue";
import type {
  OpenSheetMusicDisplay,
  GraphicalMeasure,
  SourceMeasure,
} from "opensheetmusicdisplay";
import { createLogger } from "@/utils/logger";
import type {
  ScoreMeasureInfo,
  ScoreMetaInfo,
  ScoreMusicFont,
  ScoreNoteInfo,
  ScoreSystemInfo,
} from "../types";

const logger = createLogger("useOsmd");

/** OSMD 单位 → 像素 的换算基数（1 unit = 10px @ zoom 1） */
const UNIT_IN_PX = 10;

/** 增量渲染每批小节数（避免大谱面长时间阻塞主线程） */
const RENDER_BATCH_MEASURES = 24;

/** 深色主题谱面配色（亮色符号 + 中灰谱线，替代 CSS 反色滤镜以保证滚动性能） */
const DARK_COLOR_MUSIC = "#d4d4d8";
const DARK_COLOR_STAFFLINE = "#71717a";
const DARK_COLOR_LABEL = "#a1a1aa";
/** 浅色主题谱面配色（OSMD 默认） */
const LIGHT_COLOR_MUSIC = "#000000";
const LIGHT_COLOR_STAFFLINE = "#000000";
const LIGHT_COLOR_LABEL = "#000000";

/** 调号数量 → 大调主音名（索引 = key + 7，key 范围 -7..7） */
const MAJOR_KEY_NAMES = [
  "Cb",
  "Gb",
  "Db",
  "Ab",
  "Eb",
  "Bb",
  "F",
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
];
/** 调号数量 → 小调主音名（关系小调） */
const MINOR_KEY_NAMES = [
  "Ab",
  "Eb",
  "Bb",
  "F",
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
  "G#",
  "D#",
  "A#",
];

/** 乐谱速度标记（MusicXML <sound tempo> / <metronome>） */
export interface ScoreTempoMark {
  /** 起始拍 */
  beat: number;
  /** BPM */
  bpm: number;
}

export interface OsmdLoadResult {
  notes: ScoreNoteInfo[];
  meta: ScoreMetaInfo;
  systems: ScoreSystemInfo[];
  measures: ScoreMeasureInfo[];
  /** 乐谱速度标记（升序） */
  tempoMarks: ScoreTempoMark[];
  /** 乐谱起始速度（0 表示乐谱未标注） */
  defaultBpm: number;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * OSMD 实例管理：加载 MusicXML（Endless 连续视图 + 增量渲染）、
 * 主题着色、缩放/字体变更重渲染，以及从图形模型提取音符/系统行/小节/速度标记。
 */
export function useOsmd(container: Ref<HTMLElement | undefined>) {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const ready = ref(false);
  const zoom = ref(1);

  const osmd = shallowRef<OpenSheetMusicDisplay | null>(null);
  /** 当前应用的音乐字体（VexFlow 字体名） */
  let currentFont = "Bravura";
  /** 当前谱面配色是否为深色主题 */
  let darkMode = false;

  async function ensureInstance(): Promise<OpenSheetMusicDisplay | null> {
    if (osmd.value) return osmd.value;
    if (!container.value) return null;
    try {
      const { OpenSheetMusicDisplay: OSMD } =
        await import("opensheetmusicdisplay");
      const instance = new OSMD(container.value, {
        backend: "svg",
        autoResize: false,
        followCursor: false,
        // 单张连续视图：无分页，整首曲子一条长谱
        pageFormat: "Endless",
      });
      instance.setLogLevel("warn");
      osmd.value = instance;
      return instance;
    } catch (e) {
      logger.error("OSMD 实例创建失败: " + e);
      error.value = String(e);
      return null;
    }
  }

  /** 按当前主题设置谱面配色（须在每次 render 前调用） */
  function applyThemeColors(instance: OpenSheetMusicDisplay): void {
    const rules = instance.EngravingRules;
    rules.applyDefaultColorMusic(
      darkMode ? DARK_COLOR_MUSIC : LIGHT_COLOR_MUSIC,
    );
    rules.StaffLineColor = darkMode
      ? DARK_COLOR_STAFFLINE
      : LIGHT_COLOR_STAFFLINE;
    rules.LedgerLineColorDefault = darkMode
      ? DARK_COLOR_STAFFLINE
      : LIGHT_COLOR_STAFFLINE;
    rules.DefaultColorLabel = darkMode ? DARK_COLOR_LABEL : LIGHT_COLOR_LABEL;
    rules.DefaultColorLyrics = darkMode ? DARK_COLOR_LABEL : LIGHT_COLOR_LABEL;
    rules.DefaultColorTitle = darkMode ? DARK_COLOR_LABEL : LIGHT_COLOR_LABEL;
    rules.DefaultColorChordSymbol = darkMode
      ? DARK_COLOR_LABEL
      : LIGHT_COLOR_LABEL;
  }

  /**
   * 增量渲染：按批绘制谱面，批间让出主线程，避免大谱面渲染卡死 UI。
   * @returns 渲染完成的 OSMD 实例
   */
  async function renderIncremental(
    instance: OpenSheetMusicDisplay,
  ): Promise<void> {
    let result = instance.renderNext({ measures: RENDER_BATCH_MEASURES });
    while (!result.done) {
      await nextFrame();
      result = instance.renderNext();
    }
  }

  /** 从 SourceMeasure 提取拍号字符串 */
  function getTimeSignature(sm: SourceMeasure | undefined): string {
    const ts = sm?.ActiveTimeSignature;
    if (!ts) return "-";
    return `${ts.Numerator}/${ts.Denominator}`;
  }

  /** 从 SourceMeasure 提取调号字符串（如 "C 大调"） */
  function getKeySignature(sm: SourceMeasure | undefined): string {
    try {
      const key = sm?.getKeyInstruction(0);
      if (!key || key.Key === undefined) return "-";
      const isMinor = key.Mode === 1;
      const names = isMinor ? MINOR_KEY_NAMES : MAJOR_KEY_NAMES;
      const tonic = names[key.Key + 7];
      if (!tonic) return "-";
      return isMinor ? `${tonic} 小调` : `${tonic} 大调`;
    } catch {
      return "-";
    }
  }

  function extractMeta(instance: OpenSheetMusicDisplay): ScoreMetaInfo {
    const measures = instance.Sheet.SourceMeasures;
    const first = measures[0];
    return {
      title: instance.Sheet.TitleString || "-",
      barlines: measures.length + 1,
      measures: measures.length,
      timeSignature: getTimeSignature(first),
      keySignature: getKeySignature(first),
    };
  }

  /** 从 SourceMeasure 列表构建小节时间范围 */
  function extractMeasures(
    instance: OpenSheetMusicDisplay,
  ): ScoreMeasureInfo[] {
    return instance.Sheet.SourceMeasures.map((sm, index) => {
      const startBeat = sm.AbsoluteTimestamp.RealValue * 4;
      const endBeat = startBeat + sm.Duration.RealValue * 4;
      return { index, startBeat, endBeat };
    });
  }

  /** 提取乐谱速度标记（含起始速度），供播放时间轴使用 */
  function extractTempo(instance: OpenSheetMusicDisplay): {
    tempoMarks: ScoreTempoMark[];
    defaultBpm: number;
  } {
    const tempoMarks: ScoreTempoMark[] = [];
    for (const mte of instance.Sheet.TimestampSortedTempoExpressionsList) {
      const bpm = mte.InstantaneousTempo?.TempoInBpm ?? 0;
      if (bpm > 0) {
        tempoMarks.push({ beat: mte.Timestamp.RealValue * 4, bpm });
      }
    }
    tempoMarks.sort((a, b) => a.beat - b.beat);
    const start = instance.Sheet.DefaultStartTempoInBpm;
    const defaultBpm = Number.isFinite(start) && start > 0 ? start : 0;
    // 无速度表达式时回退：部分导出器只写 <sound tempo>，OSMD 会落到小节属性
    if (tempoMarks.length === 0) {
      for (const sm of instance.Sheet.SourceMeasures) {
        const bpm = sm.TempoInBPM;
        if (Number.isFinite(bpm) && bpm > 0) {
          tempoMarks.push({
            beat: sm.AbsoluteTimestamp.RealValue * 4,
            bpm,
          });
        }
      }
    }
    return { tempoMarks, defaultBpm };
  }

  /** 从图形系统构建系统行的几何与时间范围（px 含 zoom） */
  function extractSystems(
    instance: OpenSheetMusicDisplay,
    z: number,
  ): ScoreSystemInfo[] {
    const graphic = instance.GraphicSheet;
    const systems: ScoreSystemInfo[] = [];
    const scale = UNIT_IN_PX * z;
    let index = 0;
    for (const page of graphic.MusicPages) {
      for (const system of page.MusicSystems) {
        const staff0 = system.GraphicalMeasures[0] ?? [];
        const staffAny =
          staff0.length > 0
            ? staff0
            : (system.GraphicalMeasures.find((m) => m.length > 0) ?? []);
        if (staffAny.length === 0) continue;
        const first = staffAny[0];
        const last = staffAny[staffAny.length - 1];
        const startBeat = first.parentSourceMeasure
          ? first.parentSourceMeasure.AbsoluteTimestamp.RealValue * 4
          : 0;
        const lastEnd = last.parentSourceMeasure
          ? last.parentSourceMeasure.AbsoluteTimestamp.RealValue * 4 +
            last.parentSourceMeasure.Duration.RealValue * 4
          : startBeat;
        let topY = Infinity;
        let bottomY = -Infinity;
        for (const staffMeasures of system.GraphicalMeasures) {
          for (const measure of staffMeasures) {
            const ps = measure.PositionAndShape;
            topY = Math.min(
              topY,
              (ps.AbsolutePosition.y + ps.BorderTop) * scale,
            );
            bottomY = Math.max(
              bottomY,
              (ps.AbsolutePosition.y + ps.BorderBottom) * scale,
            );
          }
        }
        if (!Number.isFinite(topY)) continue;
        systems.push({
          index: index++,
          startBeat,
          endBeat: lastEnd,
          topY,
          bottomY,
        });
      }
    }
    return systems;
  }

  /** 遍历图形模型，收集所有有音高的、可见的音符 */
  function extractNotes(
    instance: OpenSheetMusicDisplay,
    z: number,
  ): ScoreNoteInfo[] {
    const graphic = instance.GraphicSheet;
    const notes: ScoreNoteInfo[] = [];
    const scale = UNIT_IN_PX * z;
    for (const page of graphic.MusicPages) {
      for (const system of page.MusicSystems) {
        system.GraphicalMeasures.forEach((staffMeasures, staffIndex) => {
          for (const measure of staffMeasures) {
            collectMeasureNotes(measure, scale, notes, staffIndex);
          }
        });
      }
    }
    notes.sort((a, b) => a.beat - b.beat || a.midi - b.midi);
    return notes;
  }

  function collectMeasureNotes(
    measure: GraphicalMeasure,
    scale: number,
    out: ScoreNoteInfo[],
    staffIndex: number,
  ): void {
    const measureIndex = measure.parentSourceMeasure?.measureListIndex ?? 0;
    for (const staffEntry of measure.staffEntries) {
      for (const gve of staffEntry.graphicalVoiceEntries) {
        for (const gn of gve.notes) {
          const src = gn.sourceNote;
          if (!src || src.isRest() || !src.PrintObject) continue;
          const pitch = src.Pitch;
          if (!pitch) continue;
          const midi =
            (pitch.Octave + 1) * 12 +
            pitch.FundamentalNote +
            pitch.AccidentalHalfTones;
          const beat = src.getAbsoluteTimestamp().RealValue * 4;
          const durationBeats = Math.max(0, src.Length.RealValue * 4);
          const ps = gn.PositionAndShape;
          out.push({
            midi,
            beat,
            durationBeats,
            measureIndex,
            x: (ps.AbsolutePosition.x + ps.BorderLeft) * scale,
            y: (ps.AbsolutePosition.y + ps.BorderTop) * scale,
            width: (ps.BorderRight - ps.BorderLeft) * scale,
            height: (ps.BorderBottom - ps.BorderTop) * scale,
          });
        }
      }
    }
  }

  /** 重渲染后的统一提取 */
  function extractAll(
    instance: OpenSheetMusicDisplay,
    z: number,
  ): OsmdLoadResult {
    const { tempoMarks, defaultBpm } = extractTempo(instance);
    return {
      notes: extractNotes(instance, z),
      systems: extractSystems(instance, z),
      measures: extractMeasures(instance),
      tempoMarks,
      defaultBpm,
      meta: extractMeta(instance),
    };
  }

  /**
   * 加载 MusicXML（ArrayBuffer）并增量渲染
   * @returns 音符、系统行、小节、速度标记与乐谱元信息
   */
  async function loadScore(
    data: ArrayBuffer,
    font: ScoreMusicFont,
  ): Promise<OsmdLoadResult> {
    loading.value = true;
    error.value = null;
    ready.value = false;
    try {
      const instance = await ensureInstance();
      if (!instance) throw new Error("渲染容器未就绪");
      currentFont = font.charAt(0).toUpperCase() + font.slice(1);
      instance.EngravingRules.DefaultVexFlowNoteFont = currentFont;
      applyThemeColors(instance);
      const blob = new Blob([data], { type: "application/xml" });
      await instance.load(blob);
      instance.zoom = zoom.value;
      await renderIncremental(instance);
      ready.value = true;
      const result = extractAll(instance, zoom.value);
      logger.info(
        `乐谱加载完成: ${result.meta.measures} 小节, ${result.notes.length} 个音符, ${result.tempoMarks.length} 个速度标记`,
      );
      return result;
    } catch (e) {
      logger.error("MusicXML 解析失败: " + e);
      error.value = String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** 应用音乐字体并重渲染（须在 render 前设置 EngravingRules），返回重提取的数据 */
  async function applyFont(
    font: ScoreMusicFont,
  ): Promise<OsmdLoadResult | null> {
    const vfFont = font.charAt(0).toUpperCase() + font.slice(1);
    if (vfFont === currentFont) {
      return null;
    }
    currentFont = vfFont;
    const instance = osmd.value;
    if (!instance || !instance.IsReadyToRender()) {
      return null;
    }
    instance.EngravingRules.DefaultVexFlowNoteFont = vfFont;
    await renderIncremental(instance);
    return extractAll(instance, zoom.value);
  }

  /** 设置缩放并重渲染（音符/系统坐标随 zoom 重新提取） */
  function setZoom(z: number): OsmdLoadResult | null {
    zoom.value = Math.max(0.3, Math.min(3, z));
    const instance = osmd.value;
    if (!instance || !instance.IsReadyToRender()) {
      return null;
    }
    instance.zoom = zoom.value;
    // 缩放只改变几何，不做增量，直接整体重绘
    instance.render();
    return extractAll(instance, zoom.value);
  }

  /** 切换谱面配色主题（深色/浅色），返回重提取的数据 */
  function setDark(dark: boolean): OsmdLoadResult | null {
    if (dark === darkMode) return null;
    darkMode = dark;
    const instance = osmd.value;
    if (!instance || !instance.IsReadyToRender()) {
      return null;
    }
    applyThemeColors(instance);
    instance.render();
    return extractAll(instance, zoom.value);
  }

  /** 清空乐谱 */
  function clear(): void {
    osmd.value?.clear();
    ready.value = false;
    error.value = null;
  }

  return {
    osmd,
    loading,
    error,
    ready,
    zoom,
    loadScore,
    applyFont,
    setZoom,
    setDark,
    clear,
  };
}
