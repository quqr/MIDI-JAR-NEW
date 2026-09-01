import { computed, onUnmounted, ref, shallowRef, type Ref } from "vue";
import { createLogger } from "@/utils/logger";
import { PerfClock } from "@/views/WaterfallPiano/audio/PerfClock";
import { EventScheduler } from "@/views/WaterfallPiano/audio/EventScheduler";
import { SamplerSoundEngine } from "@/views/WaterfallPiano/audio/SamplerSoundEngine";
import { NOTE_MATCH_TOLERANCE_BEATS } from "../constants";
import {
  beatToSeconds,
  buildTempoMapFromMeasures,
  findCurrentMeasureIndex,
  secondsToBeat,
  systemYAtBeat,
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
  /** 起始拍（音符命中特效定位用） */
  beat: number;
}

export interface ScoreSyncViewport {
  scrollToContentY: (y: number, anchorOffsetPx: number) => void;
  getViewportHeight: () => number;
  scrollToTop: () => void;
}

export interface UseScoreSyncOptions {
  /** 视口句柄（滚动控制），就绪后由调用方赋值 */
  viewport: Ref<ScoreSyncViewport | null>;
  /** 吸顶位置（0-100，视口高度百分比）：当前行起始位置的对齐锚点 */
  snapPosition: Ref<number>;
  /** 音符命中回调（特效挂载点） */
  onNoteHit?: (notes: ScoreNoteInfo[]) => void;
}

/** setScoreData 的输入（OSMD 提取结果） */
export interface ScoreSyncData {
  notes: ScoreNoteInfo[];
  systems: ScoreSystemInfo[];
  measures: ScoreMeasureInfo[];
  tempoMarks: ScoreTempoMark[];
  defaultBpm: number;
}

/**
 * MusicXML 自驱动播放与乐谱同步：
 * 时间轴完全由乐谱本身决定——音符时值给出发声序列，
 * 速度标记（<sound tempo>/<metronome>）给出分段 tempo map。
 * PerfClock 提供秒级时间轴，EventScheduler 游标调度音符发声；
 * 谱面滚动按当前拍在相邻系统行之间连续插值，平滑无跳变。
 */
export function useScoreSync(options: UseScoreSyncOptions) {
  const { viewport, snapPosition, onNoteHit } = options;

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
  let rafId = 0;

  const scheduler = new EventScheduler<PlayEvent>({
    onTrigger: (ev) => {
      if (!soundInited) {
        soundInited = true;
        void soundEngine.init();
      }
      soundEngine.noteOn(ev.midi, DEFAULT_VELOCITY);
      // 命中特效：以事件自身的拍位与音高匹配乐谱音符
      const hits = matchNotesAt(ev.beat, ev.midi);
      if (hits.length > 0) onNoteHit?.(hits);
    },
    onRelease: (ev) => {
      soundEngine.noteOff(ev.midi);
    },
  });

  function matchNotesAt(beat: number, midi: number): ScoreNoteInfo[] {
    const matches: ScoreNoteInfo[] = [];
    for (const note of notes.value) {
      if (note.beat < beat - NOTE_MATCH_TOLERANCE_BEATS) continue;
      if (note.beat > beat + NOTE_MATCH_TOLERANCE_BEATS) break;
      if (note.midi === midi) matches.push(note);
    }
    return matches;
  }

  /** 由乐谱数据构建待播放事件序列与总时长 */
  function rebuildTimeline(
    tempoMarks: ScoreTempoMark[],
    defaultBpm: number,
  ): void {
    // 速度标记 → 分段 tempo map（{beat,bpm} → {startBeat,bpm}）
    tempoMap = buildTempoMapFromMeasures(
      tempoMarks.map((m) => ({ startBeat: m.beat, bpm: m.bpm })),
      defaultBpm > 0 ? defaultBpm : FALLBACK_BPM,
    );
    const events: PlayEvent[] = notes.value.map((n) => {
      const secPerBeat = 60 / bpmAt(n.beat);
      return {
        time: beatToSeconds(tempoMap, n.beat),
        duration: Math.max(MIN_NOTE_DURATION, n.durationBeats * secPerBeat),
        midi: n.midi,
        beat: n.beat,
      };
    });
    events.sort((a, b) => a.time - b.time);
    scheduler.setNotes(events);
    const last = measures.value[measures.value.length - 1];
    duration.value = last ? beatToSeconds(tempoMap, last.endBeat) : 0;
    currentTime.value = clock.getPosition();
    logger.info(
      `播放时间轴已重建: ${events.length} 个音符事件, 时长 ${duration.value.toFixed(1)}s`,
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

  /** 每帧驱动：调度、时间、小节、滚动 */
  function tickFrame(): void {
    const t = clock.getPosition();
    currentTime.value = t;
    scheduler.tick(t);

    // 时间轴走完 → 结束
    if (duration.value > 0 && t >= duration.value) {
      onEnd();
      return;
    }

    const beat = secondsToBeat(tempoMap, t);
    currentMeasureIndex.value = findCurrentMeasureIndex(measures.value, beat);

    // 连续滚动：当前拍在系统行间线性插值，谱面平滑上移
    const vp = viewport.value;
    const y = systemYAtBeat(systems.value, beat);
    if (vp && y !== null) {
      const anchor = (vp.getViewportHeight() * snapPosition.value) / 100;
      vp.scrollToContentY(y, anchor);
    }

    if (playbackState.value === "playing") {
      rafId = requestAnimationFrame(tickFrame);
    }
  }

  function startLoop(): void {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tickFrame);
  }

  /** 播放结束（时间轴走完） */
  function onEnd(): void {
    playbackState.value = "idle";
    cancelAnimationFrame(rafId);
    clock.stop();
    currentTime.value = 0;
    currentMeasureIndex.value = -1;
    viewport.value?.scrollToTop();
  }

  function play(): void {
    if (duration.value <= 0) return;
    if (playbackState.value === "playing") return;
    if (playbackState.value === "paused") {
      clock.start();
    } else {
      if (clock.getPosition() >= duration.value) {
        clock.seek(0);
      }
      scheduler.seek(clock.getPosition());
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

  function stop(): void {
    if (playbackState.value !== "idle") {
      clock.stop();
    }
    playbackState.value = "idle";
    cancelAnimationFrame(rafId);
    scheduler.seek(0);
    scheduler.reset();
    currentTime.value = 0;
    currentMeasureIndex.value = -1;
    viewport.value?.scrollToTop();
  }

  /** 跳转到指定秒（暂停/空闲时仅更新显示） */
  function seek(seconds: number): void {
    if (duration.value <= 0) return;
    const s = Math.max(0, Math.min(duration.value, seconds));
    clock.seek(s);
    currentTime.value = s;
    scheduler.seek(s);
    // 立即对齐滚动位置与小节显示
    const beat = secondsToBeat(tempoMap, s);
    currentMeasureIndex.value = findCurrentMeasureIndex(measures.value, beat);
    const vp = viewport.value;
    const y = systemYAtBeat(systems.value, beat);
    if (vp && y !== null) {
      const anchor = (vp.getViewportHeight() * snapPosition.value) / 100;
      vp.scrollToContentY(y, anchor);
    }
  }

  /** 更新乐谱数据（OSMD 加载/缩放/字体变化后调用），并重建播放时间轴 */
  function setScoreData(payload: ScoreSyncData): void {
    stop();
    notes.value = payload.notes;
    systems.value = payload.systems;
    measures.value = payload.measures;
    rebuildTimeline(payload.tempoMarks, payload.defaultBpm);
  }

  function clearScore(): void {
    stop();
    notes.value = [];
    systems.value = [];
    measures.value = [];
    duration.value = 0;
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
