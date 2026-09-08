import { computed, onUnmounted, ref, shallowRef, watch, type Ref } from "vue";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useOsmd } from "@/views/ScoreScroll/composables/useOsmd";
import {
  useScoreSync,
  type ScoreSyncViewport,
} from "@/views/ScoreScroll/composables/useScoreSync";
import {
  beatToSeconds,
  type TempoSegment,
} from "@/views/ScoreScroll/utils/beatMap";
import { useScore3dStore } from "../stores/Score3D";
import { Score3dEngine } from "../engine/Score3dEngine";
import { GlyphSceneStrategy } from "../engine/GlyphSceneStrategy";
import { buildScoreTempoMap } from "../engine/scoreModel";
import { DEFAULT_GLOW_PARAMS } from "../constants";
import type { StaffBand, TimeXPoint, VoiceEvent } from "../types";

/**
 * 三维乐谱引擎生命周期与播放状态管理 composable。
 *
 * 数据源为 MusicXML 自驱动（不依赖配对 MIDI）：
 * - 载入：useOsmd 解析 MusicXML → 音符 / 小节 / 速度标记 / SVG 图元
 * - 时间轴：useScoreSync 用小节速度标记构建 tempo map，音符时值驱动发声
 * - 渲染：图元 + 谱表带 → GlyphSceneStrategy（符号实体场景，ADR 0018）
 */

/** OSMD 单位 → 像素 的换算基数（1 unit = 10px @ zoom 1，与 useOsmd 一致） */
const UNIT_IN_PX = 10;
/** 谱表带 y 外扩容差（px）：覆盖符干超出谱表边界的部分 */
const BAND_Y_MARGIN_PX = 6;

/**
 * 从 OSMD 图形模型提取谱表带：一条谱表在一个系统行内的 y 区间与 x 范围。
 * 与 useOsmd.extractSystems 同一套换算（px @ zoom 1）。
 */
function extractStaffBands(
  instance: OpenSheetMusicDisplay,
  trackOfStaff: Map<number, number>,
): StaffBand[] {
  const scale = UNIT_IN_PX;
  const bands: StaffBand[] = [];
  for (const page of instance.GraphicSheet.MusicPages) {
    for (const system of page.MusicSystems) {
      system.GraphicalMeasures.forEach((staffMeasures, staffIndex) => {
        if (staffMeasures.length === 0) return;
        let yTop = Infinity;
        let yBottom = -Infinity;
        let x0 = Infinity;
        let x1 = -Infinity;
        for (const measure of staffMeasures) {
          const ps = measure.PositionAndShape;
          yTop = Math.min(yTop, (ps.AbsolutePosition.y + ps.BorderTop) * scale);
          yBottom = Math.max(
            yBottom,
            (ps.AbsolutePosition.y + ps.BorderBottom) * scale,
          );
          x0 = Math.min(x0, (ps.AbsolutePosition.x + ps.BorderLeft) * scale);
          x1 = Math.max(x1, (ps.AbsolutePosition.x + ps.BorderRight) * scale);
        }
        if (!Number.isFinite(yTop)) return;
        bands.push({
          trackIndex: trackOfStaff.get(staffIndex) ?? -1,
          yTop: yTop - BAND_Y_MARGIN_PX,
          yBottom: yBottom + BAND_Y_MARGIN_PX,
          x0,
          x1,
        });
      });
    }
  }
  return bands;
}

export function useScore3dEngine(container: Ref<HTMLElement | undefined>) {
  const engineRef = shallowRef<Score3dEngine | null>(null);
  const loaded = ref(false);
  const error = ref<string | null>(null);
  /** 符号实体构建中（挤出与合批的异步分片），与 OSMD 加载共同驱动遮罩 */
  const building = ref(false);

  const {
    loadScore,
    loading: osmdLoading,
    primitives,
    osmd,
  } = useOsmd(container);

  // 三维场景无二维滚动视口，传空视口；useScoreSync 内相关分支已做空值保护
  const viewport = ref<ScoreSyncViewport | null>(null);
  const scanlinePosition = ref(50);
  const {
    playbackState: state,
    currentTime,
    duration,
    play,
    pause,
    stop,
    seek,
    setScoreData,
  } = useScoreSync({ viewport, scanlinePosition });

  const loading = computed(() => osmdLoading.value || building.value);

  const score3dStore = useScore3dStore();
  // 设置页改背景色 → 实时应用到引擎
  watch(
    () => score3dStore.backgroundColor,
    (color) => engineRef.value?.setBackground(color),
  );

  function onEngineReady(engine: Score3dEngine): void {
    engineRef.value = engine;
    // 每帧取播放时刻：由 useScoreSync 的 RAF 循环驱动
    engine.frameCallback = () => currentTime.value;
    // 应用持久化背景色
    engine.setBackground(score3dStore.backgroundColor);
  }

  async function load(file: File): Promise<void> {
    const engine = engineRef.value;
    if (!engine || loading.value) return;
    error.value = null;
    try {
      const buffer = await file.arrayBuffer();
      // null = 期间发生了新的加载/清空（会话被取代），静默忽略
      const result = await loadScore(buffer);
      if (!result) return;

      const tempoMap = buildScoreTempoMap(result.tempoMarks, result.defaultBpm);

      // 谱表索引 → 连续声部轨索引（与 scoreModel 同一映射规则）
      const staffs = [
        ...new Set(result.notes.map((n) => n.staffIndex ?? 0)),
      ].sort((a, b) => a - b);
      const trackOfStaff = new Map(staffs.map((staff, i) => [staff, i]));

      // 时间↔谱面 x 锚点（音符秒级时间 × 谱面像素坐标）
      const noteX: TimeXPoint[] = result.notes
        .map((n) => ({
          t: beatToSeconds(tempoMap as TempoSegment[], n.beat),
          x: n.x,
          trackIndex: trackOfStaff.get(n.staffIndex ?? 0) ?? 0,
        }))
        .sort((a, b) => a.t - b.t);

      // 谱表带（符号归属声部轨 / 播放头定位）
      const instance = osmd.value;
      const bands = instance ? extractStaffBands(instance, trackOfStaff) : [];

      // 追迹小球事件序列：同拍同声部轨的符头中心分组（ADR 0019）
      const eventMap = new Map<string, VoiceEvent>();
      for (const n of result.notes) {
        const t = beatToSeconds(tempoMap as TempoSegment[], n.beat);
        const trackIndex = trackOfStaff.get(n.staffIndex ?? 0) ?? 0;
        const key = `${trackIndex}:${Math.round(t * 1e4)}`;
        let ev = eventMap.get(key);
        if (!ev) {
          ev = { t, trackIndex, notes: [] };
          eventMap.set(key, ev);
        }
        ev.notes.push({ x: n.x, y: n.y + n.height / 2 });
      }
      const voiceEvents = [...eventMap.values()].sort((a, b) => a.t - b.t);
      for (const ev of voiceEvents) {
        ev.notes.sort((a, b) => a.y - b.y);
      }

      const strategy = new GlyphSceneStrategy({
        prims: primitives.items,
        bands,
        noteX,
        voiceEvents,
        glow: DEFAULT_GLOW_PARAMS,
      });
      engine.setStrategy(strategy);
      engine.frameCallback = () => currentTime.value;

      // 构建期间保持遮罩：挤出与合批分片完成后场景完整可用（ADR 0018）
      building.value = true;
      await strategy.ready;
      if (engineRef.value !== engine) return; // 期间被卸载
      building.value = false;

      // 播放时间轴（音符时值 + 小节速度）+ 采样器发声
      setScoreData({
        notes: result.notes,
        systems: result.systems,
        measures: result.measures,
        tempoMarks: result.tempoMarks,
        defaultBpm: result.defaultBpm,
      });

      loaded.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      loaded.value = false;
    } finally {
      building.value = false;
    }
  }

  /** 回到播放头：相机注视目标吸回光点并归位默认偏移 */
  function recenter(): void {
    engineRef.value?.recenterToPlayhead();
  }

  onUnmounted(() => {
    stop();
    engineRef.value?.dispose();
    engineRef.value = null;
  });

  return {
    // 状态
    state,
    currentTime,
    duration,
    loaded,
    loading,
    error,
    // 动作
    onEngineReady,
    load,
    play,
    pause,
    stop,
    seek,
    recenter,
  };
}
