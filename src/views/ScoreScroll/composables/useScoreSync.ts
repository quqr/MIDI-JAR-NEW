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
  type TempoSegment,
} from "../utils/beatMap";
import type {
  ScoreMeasureInfo,
  ScoreNoteInfo,
  ScoreSystemInfo,
} from "../types";
import type { ScoreTempoMark } from "./useOsmd";
import { PLAYBACK_TAIL_SEC } from "../constants";

const logger = createLogger("useScoreSync");

/** 无时值音符（如装饰音）的最短发声时长（秒） */
const MIN_NOTE_DURATION = 0.08; /** 默认发声力度（MusicXML 力度记号暂不参与计算） */
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
  const { viewport, scanlinePosition } = options;

  // ── 播放状态（响应式） ──
  const playbackState = ref<"idle" | "playing" | "paused">("idle");
  const currentTime = ref(0);
  const duration = ref(0);
  const currentMeasureIndex = ref(-1);
  /**
   * 播放头世界坐标 x（未缩放内容 px，逐帧更新）：
   * 高光染色以它为锚——时间锚定、与视口平移无关（拖动画布不会改变
   * "哪些音符正在发声"），视频导出也据此驱动离屏滚动。
   */
  const playheadX = ref(0);
  /** 谱面完整布局高度（未缩放 px，视口垂直定位与视频导出布局用） */
  const contentHeightPx = ref(0);

  // ── 乐谱数据（由 useOsmd 加载结果填充） ──
  const notes = shallowRef<ScoreNoteInfo[]>([]);
  const systems = shallowRef<ScoreSystemInfo[]>([]);
  const measures = shallowRef<ScoreMeasureInfo[]>([]);

  // ── 非响应式实例 ──
  const clock = new PerfClock();
  const soundEngine = new SamplerSoundEngine();
  let soundInited = false;
  /**
   * 分段 tempo map 与 拍→X 映射（shallowRef：导出视频需要快照
   * 时间轴，重建时整体替换引用；内部读取走 .value）
   */
  const tempoMap = shallowRef<TempoSegment[]>([]);
  const beatXMap = shallowRef<BeatXPoint[]>([]);
  let rafId = 0;

  // ── 音频前瞻调度状态 ──
  // PerfClock 是墙钟：主线程卡顿后 rAF 恢复时播放头/触发会整体跳进，
  // 轮询式触发表现为音符成串补响（"突然加速"）。前瞻调度把前瞻窗口内
  // 的音符按 AudioContext 时间精确排程，卡顿只影响画面不影响节拍。
  const LOOKAHEAD_SEC = 0.15;
  /** 前瞻调度是否生效（音频时钟不可用时回退轮询触发） */
  let lookaheadActive = false;
  /** 时钟域 ↔ 音频时钟域的锚点（play/seek 时重设） */
  let audioAnchor: { clockPos: number; audioTime: number } | null = null;

  function reanchorAudio(): void {
    const now = soundEngine.getAudioNow?.() ?? null;
    audioAnchor =
      now == null ? null : { clockPos: clock.getPosition(), audioTime: now };
    lookaheadActive = audioAnchor != null;
  }

  /** 时钟位置 → AudioContext 时间 */
  function audioTimeFor(clockPos: number): number {
    return (
      audioAnchor!.audioTime +
      (clockPos - audioAnchor!.clockPos) / clock.getRate()
    );
  }

  const scheduler = new EventScheduler<PlayEvent>({
    onTrigger: (ev) => {
      if (!soundInited) {
        soundInited = true;
        void soundEngine.init();
      }
      // 前瞻调度：按 AudioContext 时间精确发声（卡顿不影响节拍）；
      // 不可用时回退轮询立即触发
      const when =
        lookaheadActive && audioAnchor ? audioTimeFor(ev.time) : null;
      if (when != null && ev.duration > 0) {
        soundEngine.scheduleNote?.(
          ev.midi,
          DEFAULT_VELOCITY,
          Math.max(when, audioAnchor!.audioTime),
          ev.duration,
        );
      } else {
        soundEngine.noteOn(ev.midi, DEFAULT_VELOCITY);
      }
    },
    onRelease: (ev) => {
      // 前瞻模式下音符由 scheduleNote 的 duration 自动收尾，
      // 且 onRelease 早于实际结束（前瞻窗口内），不再补 noteOff
      if (!lookaheadActive) soundEngine.noteOff(ev.midi);
    },
  });

  /** 由乐谱数据构建待播放事件序列与总时长 */
  function rebuildTimeline(
    tempoMarks: ScoreTempoMark[],
    defaultBpm: number,
  ): void {
    // 速度标记 → 分段 tempo map（{beat,bpm} → {startBeat,bpm}），同拍去重
    tempoMap.value = buildTempoMapFromMeasures(
      tempoMarks.map((m) => ({ startBeat: m.beat, bpm: m.bpm })),
      defaultBpm > 0 ? defaultBpm : FALLBACK_BPM,
    );

    // 音符中心 x → 拍分段映射，扫描线据此贴合当前发声音符
    // （传入小节锚点：小节内速度恒定，过小节线无速度突刺）
    beatXMap.value = buildBeatXMap(notes.value, measures.value);

    const events: PlayEvent[] = notes.value.map((n) => {
      const secPerBeat = 60 / bpmAt(n.beat);
      return {
        time: beatToSeconds(tempoMap.value, n.beat),
        duration: Math.max(MIN_NOTE_DURATION, n.durationBeats * secPerBeat),
        midi: n.midi,
      };
    });
    events.sort((a, b) => a.time - b.time);
    scheduler.setNotes(events);

    const last = measures.value[measures.value.length - 1];
    const lastNote = notes.value[notes.value.length - 1];
    const endBeat =
      lastNote != null
        ? Math.max(
            last ? last.endBeat : 0,
            lastNote.beat + lastNote.durationBeats,
          )
        : last
          ? last.endBeat
          : 0;
    duration.value = beatToSeconds(tempoMap.value, endBeat) + PLAYBACK_TAIL_SEC;
    currentTime.value = clock.getPosition();

    logger.info(
      `播放时间轴已重建: ${events.length} 个音符事件, ${beatXMap.value.length} 个拍→X 采样, 时长 ${duration.value.toFixed(1)}s`,
    );
  }

  /** 某拍位的当前速度 */
  function bpmAt(beat: number): number {
    let bpm = FALLBACK_BPM;
    for (const seg of tempoMap.value) {
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
    // 前瞻调度：多看一个前瞻窗口，音符提前排程到 AudioContext 精确时刻
    scheduler.tick(lookaheadActive ? t + LOOKAHEAD_SEC : t);

    // 时间轴走完 → 结束
    if (duration.value > 0 && t >= duration.value) {
      onEnd();
      return;
    }

    const beat = secondsToBeat(tempoMap.value, t);
    currentMeasureIndex.value = findCurrentMeasureIndex(measures.value, beat);

    // 横向连续滚动：当前拍 → 谱面 x，扫描线作为锚点对齐当前发声音符
    // （滚动更新触发视口按帧重绘）
    const x = xAtBeat(beatXMap.value, beat);
    playheadX.value = x;
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
   *  下次播放由 play() 的 idle 分支判断：进度在末尾才回开头 */
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
      // idle：从当前进度续播（seek/stop 保留 clock 位置；stop 已把
      // 调度器复位到 0，续播前须重新对齐，否则声音从头响而画面在中段）
      if (clock.getPosition() >= duration.value) {
        // 回零重播：走 seek(0) 全量对齐，进度条/播放头/滚动立即归零
        // （此前只重置 clock/scheduler，currentTime 被节流基准卡在末尾，
        //  出现"从头播放但进度条不回退"的脱节）
        seek(0);
      } else {
        scheduler.seek(clock.getPosition());
      }
      clock.start();
    }
    // 重设时钟域 ↔ 音频时钟域锚点，前瞻调度从此精确排程
    reanchorAudio();
    playbackState.value = "playing";
    startLoop();
  }

  function pause(): void {
    if (playbackState.value !== "playing") return;
    clock.pause();
    playbackState.value = "paused";
    cancelAnimationFrame(rafId);
    // 取消前瞻窗口内尚未发声的音符；光标回卷到当前位置，
    // 续播时前瞻窗口内的音符会重新排程
    soundEngine.cancelScheduledNotes?.();
    scheduler.seek(clock.getPosition());
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
    soundEngine.cancelScheduledNotes?.();
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
    const beat = secondsToBeat(tempoMap.value, s);
    currentMeasureIndex.value = findCurrentMeasureIndex(measures.value, beat);
    const x = xAtBeat(beatXMap.value, beat);
    playheadX.value = x;
    const vp = viewport.value;
    if (vp) {
      const anchor = (vp.getViewportWidth() * scanlinePosition.value) / 100;
      vp.scrollToContentX(x, anchor);
    }
    // 取消已排程到新位置之后的前瞻音符，重设音频时钟锚点
    soundEngine.cancelScheduledNotes?.();
    reanchorAudio();
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
    playheadX.value = 0;
    contentHeightPx.value = payload.contentHeightPx ?? 0;
    // Canvas 方案下 SVG 已摘除，以布局模型宽高为准
    viewport.value?.syncContentSize(
      payload.contentWidthPx,
      payload.contentHeightPx,
    );
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
    playheadX.value = 0;
    contentHeightPx.value = 0;
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
    playheadX,
    contentHeightPx,
    /** 分段 tempo map 快照（视频导出用） */
    tempoMap,
    /** 拍 → 谱面 X 映射快照（视频导出用） */
    beatXMap,
    play,
    pause,
    stop,
    seek,
    setScoreData,
    clearScore,
  };
}
