import { onUnmounted, ref, shallowRef, type Ref } from "vue";
import type { ScoreMusicFont } from "@/views/ScoreScroll/types";
import { useOsmd } from "@/views/ScoreScroll/composables/useOsmd";
import {
  useScoreSync,
  type ScoreSyncViewport,
} from "@/views/ScoreScroll/composables/useScoreSync";
import { Score3dEngine } from "../engine/Score3dEngine";
import { TrailStrategy } from "../engine/TrailStrategy";
import { layoutTrail } from "../engine/layoutTrail";
import {
  buildScoreTempoMap,
  buildTrackInfo,
  toScore3dNotesFromScore,
} from "../engine/scoreModel";
import {
  DEFAULT_ANCHOR_WINDOW,
  DEFAULT_CAMERA_OFFSET,
  DEFAULT_ENVELOPE_PARAMS,
  DEFAULT_GLOW_PARAMS,
  DEFAULT_LAYOUT_OPTIONS,
} from "../constants";
import type { TrackInfo } from "../types";

/** OSMD 渲染字体（三维场景不显示谱面，仅取数据，字体不影响取值） */
const OSMD_FONT: ScoreMusicFont = "bravura";

/**
 * 三维乐谱引擎生命周期与播放状态管理 composable。
 *
 * 数据源为 MusicXML 自驱动（不依赖配对 MIDI）：
 * - 载入：useOsmd 解析 MusicXML → 音符 / 小节 / 速度标记
 * - 时间轴：useScoreSync 用小节速度标记构建 tempo map，音符时值驱动发声
 * - 渲染：scoreModel → layoutTrail → TrailStrategy
 */
export function useScore3dEngine(container: Ref<HTMLElement | undefined>) {
  const engineRef = shallowRef<Score3dEngine | null>(null);
  const trackInfos = ref<TrackInfo[]>([]);
  const loaded = ref(false);
  const error = ref<string | null>(null);
  const visibleTracks = ref<Set<number>>(new Set());

  const { loadScore, loading } = useOsmd(container);

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

  function onEngineReady(engine: Score3dEngine): void {
    engineRef.value = engine;
    // 每帧取播放时刻：由 useScoreSync 的 RAF 循环驱动
    engine.frameCallback = () => currentTime.value;
  }

  async function load(file: File): Promise<void> {
    const engine = engineRef.value;
    if (!engine || loading.value) return;
    error.value = null;
    try {
      const buffer = await file.arrayBuffer();
      // null = 期间发生了新的加载/清空（会话被取代），静默忽略
      const result = await loadScore(buffer, OSMD_FONT);
      if (!result) return;

      const tempoMap = buildScoreTempoMap(result.tempoMarks, result.defaultBpm);
      const notes = toScore3dNotesFromScore(result.notes, tempoMap);
      const tracks = layoutTrail(notes, DEFAULT_LAYOUT_OPTIONS);

      engine.setStrategy(
        new TrailStrategy(tracks, notes, {
          layout: DEFAULT_LAYOUT_OPTIONS,
          glow: DEFAULT_GLOW_PARAMS,
          envelope: DEFAULT_ENVELOPE_PARAMS,
          anchorWindow: DEFAULT_ANCHOR_WINDOW,
          cameraOffset: DEFAULT_CAMERA_OFFSET,
        }),
      );
      engine.frameCallback = () => currentTime.value;

      // 播放时间轴（音符时值 + 小节速度）+ 采样器发声
      setScoreData({
        notes: result.notes,
        systems: result.systems,
        measures: result.measures,
        tempoMarks: result.tempoMarks,
        defaultBpm: result.defaultBpm,
      });

      trackInfos.value = buildTrackInfo(notes);
      visibleTracks.value = new Set(trackInfos.value.map((i) => i.trackIndex));
      for (const info of trackInfos.value) {
        engine.setTrackVisible(info.trackIndex, true);
      }

      loaded.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      loaded.value = false;
    }
  }

  function setTrackVisible(trackIndex: number, visible: boolean): void {
    if (visible) visibleTracks.value.add(trackIndex);
    else visibleTracks.value.delete(trackIndex);
    // 触发 Set 的响应式更新
    visibleTracks.value = new Set(visibleTracks.value);
    engineRef.value?.setTrackVisible(trackIndex, visible);
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
    trackInfos,
    visibleTracks,
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
    setTrackVisible,
  };
}
