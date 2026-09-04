import { ref, shallowRef, type Ref } from "vue";
import type {
  OpenSheetMusicDisplay,
  GraphicalMeasure,
  SourceMeasure,
} from "opensheetmusicdisplay";
import { createLogger } from "@/utils/logger";
import { PrimitiveIndex, parseSvgTopLevel, type ParseStats } from "../utils/primitives";
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

/** 增量渲染每批小节数（批间让出主线程，保持加载指示动画流畅） */
const RENDER_BATCH_MEASURES = 24;

/**
 * 一次性异步解析每片顶层节点数（ADR 0013）：
 * 渲染/解析全部完成后才解除加载遮罩，分片只为让出主线程保持 UI 响应，
 * 不依赖空闲调度（空闲分片会让大谱面"慢慢加载出来"，播放推进到
 * 未解析区域即空白——用户实测问题）。
 */
const PARSE_SLICE_NODES = 1500;

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
  "Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F",
  "C", "G", "D", "A", "E", "B", "F#", "C#",
];

/** 调号数量 → 小调主音名（关系小调） */
const MINOR_KEY_NAMES = [
  "Ab", "Eb", "Bb", "F", "C", "G", "D",
  "A", "E", "B", "F#", "C#", "G#", "D#", "A#",
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
  /**
   * 谱面完整布局宽度（未缩放 px，含末尾小节线）。
   * 分块渲染下 SVG 可能只绘制了前几个窗口，DOM 测量值偏小，
   * 视口内容宽度须以此为准。
   */
  contentWidthPx: number;
  /**
   * 谱面完整布局高度（未缩放 px）。
   * Canvas 方案下 SVG 解析后即从 DOM 摘除，视口垂直定位以布局模型为准。
   */
  contentHeightPx: number;
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
  /**
   * 加载会话令牌（ADR 0013）：每次 loadScore / applyFont / setDark / clear
   * 开始时自增。渲染与解析的 async 循环每步核对自己开启时的令牌，
   * 不匹配即静默中止——防止快速连续加载/切主题时旧会话污染新状态。
   */
  let loadSession = 0;

  /**
   * 图元缓存：OSMD 渲染产出的 SVG 被解析为矢量图元后丢弃 DOM，
   * 谱面显示由 Canvas 渲染器按可见窗口从本索引取数据重绘。
   */
  const primitives = new PrimitiveIndex();
  /** 解析进度版本号：每完成一片解析自增，视口据此请求重绘 */
  const primitivesVersion = ref(0);
  /** 元素构成统计（聚合，解析完成时输出一次） */
  let statsTotal: ParseStats | null = null;
  let statsLogged = false;

  async function ensureInstance(): Promise<OpenSheetMusicDisplay | null> {
    if (osmd.value) return osmd.value;
    if (!container.value) return null;
    try {
      const { OpenSheetMusicDisplay: OSMD } = await import("opensheetmusicdisplay");
      const instance = new OSMD(container.value, {
        backend: "svg",
        autoResize: false,
        followCursor: false,
        // 单行连续视图：整首曲子铺在一条横向谱线上，谱面相对扫描线横向滚动
        pageFormat: "Endless",
        // 关键：单行横向连续谱面（OSMD 须在 load 前设置）
        renderSingleHorizontalStaffline: true,
      });
      instance.setLogLevel("warn");
      // 单行模式下标题/副标题/词作者会脱离谱行错位，关闭以保持谱面干净
      instance.EngravingRules.RenderTitle = false;
      instance.EngravingRules.RenderSubtitle = false;
      instance.EngravingRules.RenderLyricist = false;
      instance.EngravingRules.RenderComposer = false;
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
    rules.StaffLineColor = darkMode ? DARK_COLOR_STAFFLINE : LIGHT_COLOR_STAFFLINE;
    rules.LedgerLineColorDefault = darkMode ? DARK_COLOR_STAFFLINE : LIGHT_COLOR_STAFFLINE;
    rules.DefaultColorLabel = darkMode ? DARK_COLOR_LABEL : LIGHT_COLOR_LABEL;
    rules.DefaultColorLyrics = darkMode ? DARK_COLOR_LABEL : LIGHT_COLOR_LABEL;
    rules.DefaultColorTitle = darkMode ? DARK_COLOR_LABEL : LIGHT_COLOR_LABEL;
    rules.DefaultColorChordSymbol = darkMode ? DARK_COLOR_LABEL : LIGHT_COLOR_LABEL;
  }

  /** 取 OSMD 当前渲染的 SVG 根（backend 引用优先，容器查询兜底） */
  function getSvgRoot(instance: OpenSheetMusicDisplay): SVGSVGElement | null {
    const backend = (
      instance as unknown as {
        Backend?: { getSvgElement?: () => SVGSVGElement | null };
      }
    ).Backend;
    const svg = backend?.getSvgElement?.();
    if (svg) return svg;
    return (container.value?.querySelector("svg") as SVGSVGElement | null) ?? null;
  }

  function accumulateStats(s: ParseStats): void {
    if (!statsTotal) {
      statsTotal = { ...s };
      return;
    }
    statsTotal.paths += s.paths;
    statsTotal.texts += s.texts;
    statsTotal.rects += s.rects;
    statsTotal.lines += s.lines;
    statsTotal.ellipses += s.ellipses;
    statsTotal.polys += s.polys;
    statsTotal.groups += s.groups;
    statsTotal.skipped += s.skipped;
  }

  function logParseStatsOnce(): void {
    if (statsLogged || !statsTotal) return;
    statsLogged = true;
    const t = statsTotal;
    logger.info(
      `SVG→图元解析完成: path=${t.paths} text=${t.texts} rect=${t.rects} line=${t.lines} ellipse=${t.ellipses} poly=${t.polys} g=${t.groups} 跳过=${t.skipped}`,
    );
  }

  /**
   * 解析 SVG 根当前的顶层节点为图元并从 DOM 摘除。
   * 探针已确认渲染路径只追加不回查（见 ADR 0010）：
   * 批次间摘除安全，摘除同时提前释放 DOM 内存。
   * maxNodes 限制单次解析量（全量重渲染后的存量按片解析）。
   */
  function flushNewSvgNodes(instance: OpenSheetMusicDisplay, maxNodes: number): void {
    const svg = getSvgRoot(instance);
    if (!svg || svg.childElementCount === 0) return;
    const res = parseSvgTopLevel(svg, maxNodes);
    if (res.prims.length > 0) {
      primitives.add(res.prims);
      primitivesVersion.value++;
    }
    accumulateStats(res.stats);
    for (const node of res.nodes) {
      node.parentNode?.removeChild(node);
    }
    if (svg.childElementCount === 0) logParseStatsOnce();
  }

  /**
   * 增量渲染：按批绘制谱面直到画完全谱（ADR 0013——Canvas 方案下
   * 视觉图元来自 SVG，画不完就没有完整图元，不提前停止）。
   * 批间让出主线程保持加载指示动画流畅，每批产出立即解析为图元并从 DOM 摘除。
   * 会话失效（期间发生新的加载/清空）时返回 false，调用方静默中止。
   */
  async function renderIncremental(
    instance: OpenSheetMusicDisplay,
    session: number,
  ): Promise<boolean> {
    let result = instance.renderNext({ measures: RENDER_BATCH_MEASURES });
    flushNewSvgNodes(instance, Number.POSITIVE_INFINITY);
    while (!result.done) {
      if (session !== loadSession) return false;
      await nextFrame();
      result = instance.renderNext({ measures: RENDER_BATCH_MEASURES });
      flushNewSvgNodes(instance, Number.POSITIVE_INFINITY);
    }
    return true;
  }

  /**
   * 一次性异步解析（ADR 0013）：循环解析 SVG 存量直到清空，
   * 片间让出一帧保持 UI 响应；会话失效即静默中止。
   * 不依赖空闲调度——空闲分片会让大谱面在加载后"慢慢浮现"，
   * 播放推进到未解析区域即空白（用户实测问题）。
   * 全量重渲染（字体/主题）后的存量清理由此完成。
   */
  async function parseAllSvgNodes(
    instance: OpenSheetMusicDisplay,
    session: number,
  ): Promise<boolean> {
    let svg = getSvgRoot(instance);
    while (svg != null && svg.childElementCount > 0) {
      if (session !== loadSession) return false;
      flushNewSvgNodes(instance, PARSE_SLICE_NODES);
      await nextFrame();
      svg = getSvgRoot(instance);
    }
    return true;
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
  function extractMeasures(instance: OpenSheetMusicDisplay): ScoreMeasureInfo[] {
    return instance.Sheet.SourceMeasures.map((sm, index) => {
      const startBeat = sm.AbsoluteTimestamp.RealValue * 4;
      const endBeat = startBeat + sm.Duration.RealValue * 4;
      return { index, startBeat, endBeat };
    });
  }

  /**
   * 提取乐谱速度标记（含起始速度），供播放时间轴使用。
   *
   * 同时纳入两类来源并按拍去重，避免「同拍不同速」破坏分段累加导致时间轴错乱：
   * 1) Sheet.TimestampSortedTempoExpressionsList —— <metronome> 表达式（InstantaneousTempo）；
   * 2) 每个 SourceMeasure.TempoInBPM —— <sound tempo> 直接落在小节属性上的回退来源。
   * 同拍冲突时表达式优先（更精确）；表达式为空时按小节 BPM 兜底。
   */
  function extractTempo(instance: OpenSheetMusicDisplay): {
    tempoMarks: ScoreTempoMark[];
    defaultBpm: number;
  } {
    const byBeat = new Map<number, number>();
    const roundBeat = (v: number): number => Math.round(v * 1e6) / 1e6;

    for (const mte of instance.Sheet.TimestampSortedTempoExpressionsList) {
      const bpm = mte.InstantaneousTempo?.TempoInBpm ?? 0;
      if (bpm > 0) byBeat.set(roundBeat(mte.Timestamp.RealValue * 4), bpm);
    }
    for (const sm of instance.Sheet.SourceMeasures) {
      const bpm = sm.TempoInBPM;
      if (Number.isFinite(bpm) && bpm > 0) {
        const beat = roundBeat(sm.AbsoluteTimestamp.RealValue * 4);
        if (!byBeat.has(beat)) byBeat.set(beat, bpm);
      }
    }

    const tempoMarks: ScoreTempoMark[] = [...byBeat.entries()]
      .map(([beat, bpm]) => ({ beat, bpm }))
      .sort((a, b) => a.beat - b.beat);

    const start = instance.Sheet.DefaultStartTempoInBpm;
    const defaultBpm = Number.isFinite(start) && start > 0 ? start : 0;
    return { tempoMarks, defaultBpm };
  }

  /**
   * 从图形系统构建系统行的几何与时间范围（px 含 zoom），
   * 同时给出谱面完整布局宽度与高度（Canvas 方案下 SVG 解析后即摘除，
   * 视口内容尺寸以布局模型为准）。
   */
  function extractSystems(
    instance: OpenSheetMusicDisplay,
    z: number,
  ): {
    systems: ScoreSystemInfo[];
    contentWidthPx: number;
    contentHeightPx: number;
  } {
    const graphic = instance.GraphicSheet;
    const systems: ScoreSystemInfo[] = [];
    const scale = UNIT_IN_PX * z;
    let index = 0;
    let maxRight = 0;
    let maxBottom = 0;

    for (const page of graphic.MusicPages) {
      for (const system of page.MusicSystems) {
        const staff0 = system.GraphicalMeasures[0] ?? [];
        const staffAny = staff0.length > 0
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
            topY = Math.min(topY, (ps.AbsolutePosition.y + ps.BorderTop) * scale);
            bottomY = Math.max(bottomY, (ps.AbsolutePosition.y + ps.BorderBottom) * scale);
            maxRight = Math.max(
              maxRight,
              (ps.AbsolutePosition.x + ps.BorderRight) * scale,
            );
          }
        }
        if (!Number.isFinite(topY)) continue;
        maxBottom = Math.max(maxBottom, bottomY);

        systems.push({ index: index++, startBeat, endBeat: lastEnd, topY, bottomY });
      }
    }
    return { systems, contentWidthPx: maxRight, contentHeightPx: maxBottom };
  }

  /** 遍历图形模型，收集所有有音高的、可见的音符 */
  function extractNotes(instance: OpenSheetMusicDisplay, z: number): ScoreNoteInfo[] {
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
            (pitch.Octave + 1) * 12 + pitch.FundamentalNote + pitch.AccidentalHalfTones;
          const beat = src.getAbsoluteTimestamp().RealValue * 4;
          const durationBeats = Math.max(0, src.Length.RealValue * 4);
          const ps = gn.PositionAndShape;

          out.push({
            midi,
            beat,
            durationBeats,
            staffIndex,
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
  function extractAll(instance: OpenSheetMusicDisplay, z: number): OsmdLoadResult {
    const { tempoMarks, defaultBpm } = extractTempo(instance);
    const { systems, contentWidthPx, contentHeightPx } = extractSystems(instance, z);
    return {
      notes: extractNotes(instance, z),
      systems,
      measures: extractMeasures(instance),
      tempoMarks,
      defaultBpm,
      meta: extractMeta(instance),
      contentWidthPx,
      contentHeightPx,
    };
  }

  /**
   * 加载 MusicXML（ArrayBuffer）并一次性完成渲染与图元解析（ADR 0013）：
   * 渲染批间、解析片间让出主线程（加载指示动画流畅），全部完成后才返回
   * ——调用方解除加载遮罩时谱面即完整可用，播放推进不再遇到未解析区域。
   * @returns 加载结果；期间发生新的加载/清空（会话失效）时返回 null
   */
  async function loadScore(
    data: ArrayBuffer,
    font: ScoreMusicFont,
  ): Promise<OsmdLoadResult | null> {
    const session = ++loadSession;
    loading.value = true;
    error.value = null;
    ready.value = false;
    try {
      const instance = await ensureInstance();
      if (!instance) throw new Error("渲染容器未就绪");
      if (session !== loadSession) return null;
      currentFont = font.charAt(0).toUpperCase() + font.slice(1);
      instance.EngravingRules.DefaultVexFlowNoteFont = currentFont;
      applyThemeColors(instance);
      // 令牌已自增：上一谱面遗留的渲染/解析循环会在下一步自查退出；
      // 图元缓存与统计复位后从零开始累积
      primitives.clear();
      primitivesVersion.value++;
      statsTotal = null;
      statsLogged = false;
      const blob = new Blob([data], { type: "application/xml" });
      await instance.load(blob);
      if (session !== loadSession) return null;
      instance.zoom = zoom.value;
      const completed = await renderIncremental(instance, session);
      // 渲染批次本已随产随解析；此处兜底确保 SVG 存量清零后才宣告完成
      if (!completed || !(await parseAllSvgNodes(instance, session))) {
        return null;
      }
      ready.value = true;
      const result = extractAll(instance, zoom.value);
      logger.info(
        `乐谱加载完成: ${result.meta.measures} 小节, ${result.notes.length} 个音符, ${result.tempoMarks.length} 个速度标记`,
      );
      return result;
    } catch (e) {
      if (session !== loadSession) return null; // 已被新会话取代，静默退出
      logger.error("MusicXML 解析失败: " + e);
      error.value = String(e);
      throw e;
    } finally {
      if (session === loadSession) loading.value = false;
    }
  }

  /**
   * 应用音乐字体并重渲染（须在 render 前设置 EngravingRules），返回重提取的数据。
   * 字体改变度量须整谱重排：全量渲染（会重置增量会话），随后一次性异步
   * 解析完存量 SVG 才返回（加载遮罩期间完成，ADR 0013）。
   * @returns 重提取数据；无变化/未就绪/会话失效时返回 null
   */
  async function applyFont(font: ScoreMusicFont): Promise<OsmdLoadResult | null> {
    const vfFont = font.charAt(0).toUpperCase() + font.slice(1);
    if (vfFont === currentFont) {
      return null;
    }
    currentFont = vfFont;
    const instance = osmd.value;
    if (!instance || !instance.IsReadyToRender()) {
      return null;
    }
    const session = ++loadSession;
    loading.value = true;
    try {
      instance.EngravingRules.DefaultVexFlowNoteFont = vfFont;
      instance.render();
      resetPrimitives();
      if (!(await parseAllSvgNodes(instance, session))) return null;
      return extractAll(instance, zoom.value);
    } finally {
      if (session === loadSession) loading.value = false;
    }
  }

  /** 全量重渲染后的图元缓存重建：清旧缓存、复位统计（解析由调用方接管） */
  function resetPrimitives(): void {
    primitives.clear();
    primitivesVersion.value++;
    statsTotal = null;
    statsLogged = false;
  }

  /**
   * 切换谱面配色主题（深色/浅色），返回重提取的数据。
   * 全量渲染后一次性异步解析完存量 SVG 才返回（加载遮罩期间完成，ADR 0013）。
   * @returns 重提取数据；无变化/未就绪/会话失效时返回 null
   */
  async function setDark(dark: boolean): Promise<OsmdLoadResult | null> {
    if (dark === darkMode) return null;
    const instance = osmd.value;
    if (!instance || !instance.IsReadyToRender()) {
      return null;
    }
    const session = ++loadSession;
    loading.value = true;
    try {
      darkMode = dark;
      applyThemeColors(instance);
      instance.render();
      resetPrimitives();
      if (!(await parseAllSvgNodes(instance, session))) return null;
      return extractAll(instance, zoom.value);
    } finally {
      if (session === loadSession) loading.value = false;
    }
  }

  /** 清空乐谱 */
  function clear(): void {
    ++loadSession; // 使遗留的渲染/解析会话立即失效
    osmd.value?.clear();
    ready.value = false;
    error.value = null;
    resetPrimitives();
  }

  return {
    osmd,
    loading,
    error,
    ready,
    zoom,
    loadScore,
    applyFont,
    setDark,
    clear,
    primitives,
    primitivesVersion,
  };
}
