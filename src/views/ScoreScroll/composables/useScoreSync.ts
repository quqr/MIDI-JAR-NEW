import { computed, onUnmounted, ref, shallowRef, type Ref } from "vue";
import { createLogger } from "@/utils/logger";
import { PerfClock } from "@/views/WaterfallPiano/audio/PerfClock";
import { EventScheduler } from "@/views/WaterfallPiano/audio/EventScheduler";
import { SamplerSoundEngine } from "@/views/WaterfallPiano/audio/SamplerSoundEngine";
import {
  beatToSeconds,
  buildBeatXMap,
  buildTempoMapFromMeasures,
  findCurrentMeasureIndex,
  secondsToBeat,
  xAtBeat,
  type BeatXPoint,
} from "../utils/beatMap";
import type {
  ScoreMeasureInfo,
  ScoreNoteInfo,
  ScoreSystemInfo,
} from "../types";
import type { ScoreTempoMark } from "./useOsmd";

const logger = createLogger("useScoreSync");

/** 无时值音符（如装饰音）的最短发声时长（秒） */
const MIN_NOTE_DURATION = 0.08;
/** 默认发声力度（MusicXML 力度记号暂不参与计算） */
const DEFAULT_VELOCITY = 80;
/** 默认 BPM（乐谱完全无速度标记时） */
const FALLBACK_BPM = 120;

/** 单个待播放音符事件（秒级时间轴） */
interface PlayEvent {
  time: number;
  duration: number;
  midi: number;
}

export interface ScoreSyncViewport {
  scrollToContentX: (x: number, anchorOffsetPx: number) => void;
  getViewportWidth: () => number;
  scrollToStart: () => void;
  /**
   * 在乐谱数据/缩放/主题/字体变更后刷新视口测量与内容偏移。
   * @param explicitWidth - 谱面完整布局宽度（未缩放 px）。
   * @param explicitHeight - 谱面完整布局高度（未缩放 px）。
   *   Canvas 方案下 SVG 解析后即摘除，尺寸以布局模型为准。
   *   省略时沿用上次值。
   */
  syncContentSize: (explicitWidth?: number, explicitHeight?: number) => void;
}

export interface UseScoreSyncOptions {
  /** 视口句柄（滚动控制），就绪后由调用方赋值 */
  viewport: Ref<ScoreSyncViewport | null>;
  /** 扫描线位置（0-100，视口宽度百分比）：当前发声音符对齐于此 */
  scanlinePosition: Ref<number>;
}

/** setScoreData 的输入（OSMD 提取结果） */
export interface ScoreSyncData {
  notes: ScoreNoteInfo[];
  systems: ScoreSystemInfo[];
  measures: ScoreMeasureInfo[];
  tempoMarks: ScoreTempoMark[];
  defaultBpm: number;
  /** 谱面完整布局宽度（未缩放 px），透传给视口 */
  contentWidthPx?: number;
  /** 谱面完整布局高度（未缩放 px），透传给视口用于垂直定位 */
  contentHeightPx?: number;
}

/**
 * MusicXML 自驱动播放与乐谱同步（单行横向连续视图）：
 * 时间轴完全由乐谱本身决定——音符时值给出发声序列，
 * 速度标记（<sound tempo>/<metronome>）给出分段 tempo map。
 * PerfClock 提供秒级时间轴，EventScheduler 游标调度音符发声；
 * 谱面滚动按当前拍在「相邻音符中心 x」之间线性插值，
 * 使竖直扫描线始终贴合当前发声的音符头，而非按行起点匀速漂移。
 * （Canvas 方案下谱面渲染由图元缓存 + 每帧可见窗口重绘承担，
 * 播放推进只需更新视口偏移。）
 */
export function useScoreSync(options: UseScoreSyncOptions) {
  const {
    viewport,
    scanlinePosition,
  } = options;

  // ── 播放状态（响应式） ──
  const playbackState = ref<"idle" | "playing" | "paused">("idle");
  const currentTime = ref(0);
  const duration = ref(0);
  const currentMeasureIndex = ref(-1);

  // ── 乐谱数据（由 useOsmd 加载结果填充） ──
  const notes = shallowRef<ScoreNoteInfo[]>([]);
  const systems = shallowRef<ScoreSystemInfo[]>([]);
  const measures = shallowRef<ScoreMeasureInfo[]>([]);

  // ── 非响应式实例 ──
  const clock = new PerfClock();
  const soundEngine = new SamplerSoundEngine();
  let soundInited = false;
  let tempoMap: ReturnType<typeof buildTempoMapFromMeasures> = [];
  /** 拍 → 谱面 X 分段映射（单行连续视图滚动锚定） */
  let beatXMap: BeatXPoint[] = [];
  let rafId = 0;

  const scheduler = new EventScheduler<PlayEvent>({
    onTrigger: (ev) => {
      if (!soundInited) {
        soundInited = true;
        void soundEngine.init();
      }
      soundEngine.noteOn(ev.midi, DEFAULT_VELOCITY);
    },
    onRelease: (ev) => {
      soundEngine.noteOff(ev.midi);
    },
  });

  /** 由乐谱数据构建待播放事件序列与总时长 */
  function rebuildTimeline(
    tempoMarks: ScoreTempoMark[],
    defaultBpm: number,
  ): void {
    // 速度标记 → 分段 tempo map（{beat,bpm} → {startBeat,bpm}），同拍去重
    tempoMap = buildTempoMapFromMeasures(
      tempoMarks.map((m) => ({ startBeat: m.beat, bpm: m.bpm })),
      defaultBpm > 0 ? defaultBpm : FALLBACK_BPM,
    );

    // 音符中心 x → 拍分段映射，扫描线据此贴合当前发声音符
    beatXMap = buildBeatXMap(notes.value);

    const events: PlayEvent[] = notes.value.map((n) => {
      const secPerBeat = 60 / bpmAt(n.beat);
      return {
        time: beatToSeconds(tempoMap, n.beat),
        duration: Math.max(MIN_NOTE_DURATION, n.durationBeats * secPerBeat),
        midi: n.midi,
      };
    });
    events.sort((a, b) => a.time - b.time);
    scheduler.setNotes(events);

    const last = measures.value[measures.value.length - 1];
    const lastNote = notes.value[notes.value.length - 1];
    const endBeat = lastNote != null
      ? Math.max(
          last ? last.endBeat : 0,
          lastNote.beat + lastNote.durationBeats,
        )
      : last
        ? last.endBeat
        : 0;
    duration.value = beatToSeconds(tempoMap, endBeat);
    currentTime.value = clock.getPosition();

    logger.info(
      `播放时间轴已重建: ${events.length} 个音符事件, ${beatXMap.length} 个拍→X 采样, 时长 ${duration.value.toFixed(1)}s`,
    );
  }

  /** 某拍位的当前速度 */
  function bpmAt(beat: number): number {
    let bpm = FALLBACK_BPM;
    for (const seg of tempoMap) {
      if (seg.startBeat <= beat) bpm = seg.bpm;
      else break;
    }
    return bpm;
  }

  // UI 节流：时间文本/进度条 10Hz 刷新（原站 250ms），滚动与调度仍逐帧
  let lastTimeEmit = -1;

  /** 每帧驱动：调度、时间、小节、滚动 */
  function tickFrame(): void {
    const t = clock.getPosition();
    if (t - lastTimeEmit >= 0.1) {
      currentTime.value = t;
      lastTimeEmit = t;
    }
    scheduler.tick(t);

    // 时间轴走完 → 结束
    if (duration.value > 0 && t >= duration.value) {
      onEnd();
      return;
    }

    const beat = secondsToBeat(tempoMap, t);
    currentMeasureIndex.value = findCurrentMeasureIndex(measures.value, beat);

    // 横向连续滚动：当前拍 → 谱面 x，扫描线作为锚点对齐当前发声音符
    // （滚动更新触发视口按帧重绘）
    const x = xAtBeat(beatXMap, beat);
    const vp = viewport.value;
    if (vp) {
      const anchor = (vp.getViewportWidth() * scanlinePosition.value) / 100;
      vp.scrollToContentX(x, anchor);
    }

    if (playbackState.value === "playing") {
      rafId = requestAnimationFrame(tickFrame);
    }
  }

  function startLoop(): void {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tickFrame);
  }

  /** 播放结束（时间轴走完）：冻结在末尾——进度条/视口停在原地，
   *  下次播放由 play() 的 idle 分支强制回到开头 */
  function onEnd(): void {
    playbackState.value = "idle";
    cancelAnimationFrame(rafId);
    clock.pause();
  }

  function play(): void {
    if (duration.value <= 0) return;
    if (playbackState.value === "playing") return;
    if (playbackState.value === "paused") {
      clock.start();
    } else {
      // idle（未播放/已停止/已播完）一律从开头开始：
      // 已显现内容收回、曲谱回到开头（ADR 0011 遗产）
      clock.seek(0);
      scheduler.seek(0);
      clock.start();
    }
    playbackState.value = "playing";
    startLoop();
  }

  function pause(): void {
    if (playbackState.value !== "playing") return;
    clock.pause();
    playbackState.value = "paused";
    cancelAnimationFrame(rafId);
  }

  /** 停止：冻结当前显示状态（进度条/视口停在原地），静音并退出播放 */
  function stop(): void {
    if (playbackState.value === "playing") {
      clock.pause();
    }
    playbackState.value = "idle";
    cancelAnimationFrame(rafId);
    scheduler.seek(0);
    scheduler.reset();
  }

  /** 跳转到指定秒（任意状态下立即对齐显示）：时间、滚动、小节同步更新 */
  function seek(seconds: number): void {
    if (duration.value <= 0) return;
    const s = Math.max(0, Math.min(duration.value, seconds));
    clock.seek(s);
    currentTime.value = s;
    lastTimeEmit = s;
    scheduler.seek(s);

    // 立即对齐滚动位置与小节显示
    const beat = secondsToBeat(tempoMap, s);
    currentMeasureIndex.value = findCurrentMeasureIndex(measures.value, beat);
    const x = xAtBeat(beatXMap, beat);
    const vp = viewport.value;
    if (vp) {
      const anchor = (vp.getViewportWidth() * scanlinePosition.value) / 100;
      vp.scrollToContentX(x, anchor);
    }
  }

  /** 更新乐谱数据（OSMD 加载/缩放/字体变化后调用），并重建播放时间轴 */
  function setScoreData(payload: ScoreSyncData): void {
    stop();
    // 新谱从开头呈现：时间归零 → 重建时间轴 → 视口回开头
    clock.stop();
    notes.value = payload.notes;
    systems.value = payload.systems;
    measures.value = payload.measures;
    rebuildTimeline(payload.tempoMarks, payload.defaultBpm);
    lastTimeEmit = -1;
    currentMeasureIndex.value = -1;
    // Canvas 方案下 SVG 已摘除，以布局模型宽高为准
    viewport.value?.syncContentSize(payload.contentWidthPx, payload.contentHeightPx);
    viewport.value?.scrollToStart();
  }

  function clearScore(): void {
    stop();
    notes.value = [];
    systems.value = [];
    measures.value = [];
    duration.value = 0;
    currentTime.value = 0;
    lastTimeEmit = -1;
    currentMeasureIndex.value = -1;
    viewport.value?.scrollToStart();
  }

  onUnmounted(() => {
    cancelAnimationFrame(rafId);
    clock.stop();
  });

  const progress = computed(() => {
    if (duration.value <= 0) return 0;
    return Math.min(1, currentTime.value / duration.value);
  });

  return {
    playbackState,
    currentTime,
    duration,
    progress,
    currentMeasureIndex,
    play,
    pause,
    stop,
    seek,
    setScoreData,
    clearScore,
  };
}
