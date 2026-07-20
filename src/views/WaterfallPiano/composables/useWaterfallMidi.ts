import {
  ref,
  shallowRef,
  onMounted,
  onUnmounted,
  watch,
  type ComputedRef,
  type Ref,
  type ShallowRef,
} from "vue";
import { createLogger } from "@/utils/logger";
import { MidiFilePlayer } from "../midi/MidiFilePlayer";
import { Recorder } from "../audio/Recorder";
import type { WaterfallEngine } from "../engine/WaterfallEngine";
import type { NoteBlockMode } from "../engine/NoteBlockSystem";
import { PlayerStateMachine } from "../state/PlayerStateMachine";
import type { MidiTrackInfo } from "../types";
import {
  createPlaybackStrategy,
  type PlaybackStrategy,
  type EngineRef,
} from "../strategies/modeStrategies";
import { useRealtimeMidi } from "./useRealtimeMidi";
import type { useWaterfallPianoStore } from "../stores/WaterfallPiano";

const logger = createLogger("WaterfallMidi");

/** 瀑布流钢琴设置 store 的实例类型（结构化复用，避免重复签名） */
type WaterfallPianoStore = ReturnType<typeof useWaterfallPianoStore>;

export interface UseWaterfallMidiOptions {
  stateMachine: PlayerStateMachine;
  engineRef: ShallowRef<WaterfallEngine | null>;
  mode: Ref<NoteBlockMode>;
  isPlaying: ComputedRef<boolean>;
  isPaused: ComputedRef<boolean>;
  errorMessage: Ref<string>;
  /** 确保音频上下文已初始化（处理浏览器自动播放策略） */
  ensureAudioReady: () => Promise<void>;
  /** 设置持久化的瀑布流钢琴设置 store */
  store: WaterfallPianoStore;
}

/**
 * MIDI 文件与录音管理 composable
 *
 * 集中管理 {@link MidiFilePlayer} 与 {@link Recorder} 的生命周期、回放控制、
 * 音轨/速度/循环设置，以及实时 MIDI 输入接入。
 *
 * 通过 {@link PlaybackStrategy} 暴露给引擎 frameCallback 的 tick 入口，
 * 并提供 play/pause/stop/seek 的统一调用路径，消除原先基于 contentType 的 if/else 分支。
 *
 * 策略选择基于 contentType：midi 对应 synthesia 显示模式，recording 对应 realtime 显示模式。
 */
export function useWaterfallMidi(options: UseWaterfallMidiOptions) {
  const {
    stateMachine,
    engineRef,
    mode,
    isPlaying,
    isPaused,
    errorMessage,
    ensureAudioReady,
    store,
  } = options;

  // ── 播放内容状态 ──
  const contentType = ref<"none" | "recording" | "midi">("none");
  const isRecording = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const fileName = ref("");
  const tracks = ref<MidiTrackInfo[]>([]);
  const selectedTracks = ref<number[]>([]);

  // ── 播放源实例（非响应式，避免深层代理开销） ──
  const recorderRef = shallowRef<Recorder | null>(null);
  let player: MidiFilePlayer | null = null;
  let recorder: Recorder | null = null;

  /**
   * 根据当前 contentType 与播放源创建播放策略
   *
   * 引擎 frameCallback 与 play/pause/stop/seek 入口统一调用此方法，
   * 不再使用 if/else 区分 midi 与 recording。
   * @returns 当前可用的播放策略；无可用源时返回 null
   */
  function getStrategy(): PlaybackStrategy | null {
    return createPlaybackStrategy(
      contentType.value,
      player,
      recorder,
      engineRef as EngineRef,
    );
  }

  // ── 录音事件捕获（来自画布的音符触发） ──
  function onCanvasNoteOn(midi: number, vel: number): void {
    if (isRecording.value && recorder) recorder.recordNoteOn(midi, vel);
  }

  function onCanvasNoteOff(midi: number): void {
    if (isRecording.value && recorder) recorder.recordNoteOff(midi);
  }

  /**
   * 加载 MIDI 文件并切换至 synthesia 模式
   * 严格限制：仅 idle/ready 时允许加载
   * @param file - 用户选择的 MIDI 文件
   */
  async function onLoadMidi(file: File): Promise<void> {
    if (!player || !stateMachine.canLoadFile) {
      logger.warn(`Cannot load MIDI in state: ${stateMachine.getState()}`);
      return;
    }
    if (!stateMachine.setState("loading")) return;
    try {
      mode.value = "synthesia";
      engineRef.value?.setMode("synthesia");
      await player.loadFile(file);
      fileName.value = file.name;
      contentType.value = "midi";
      duration.value = player.getDuration();
      currentTime.value = 0;
      stateMachine.setState("ready");
    } catch (e) {
      logger.error({ err: e }, "loadFile failed");
      errorMessage.value = e instanceof Error ? e.message : String(e);
      stateMachine.setState("error");
    }
  }

  /**
   * 切换录制状态（严格限制：idle → recording → idle）
   */
  function onToggleRecord(): void {
    if (!recorder) return;
    if (isRecording.value) {
      const notes = recorder.stopRecording();
      isRecording.value = false;
      if (notes.length > 0) {
        contentType.value = "recording";
        duration.value = recorder.getDuration();
      }
      stateMachine.setState("idle");
    } else {
      if (isPlaying.value) onStop();
      if (!stateMachine.setState("recording")) return;
      recorder.startRecording();
      isRecording.value = true;
    }
  }

  /**
   * 开始或恢复播放（严格限制：ready/paused → playing）
   *
   * 通过策略统一调用 start/resume，并由 managesFluid 标志决定是否联动流体渲染。
   */
  async function onPlay(): Promise<void> {
    if (!stateMachine.canPlay) {
      logger.warn(`Cannot play in state: ${stateMachine.getState()}`);
      return;
    }
    await ensureAudioReady();
    const strategy = getStrategy();
    if (strategy) {
      if (isPaused.value) strategy.resumePlayback();
      else strategy.startPlayback();
      engineRef.value?.noteBlockSystemRef.setTransportPlaying(true);
      // MIDI 模式：恢复流体渲染
      if (strategy.managesFluid) {
        engineRef.value?.setFluidPaused(false);
      }
    }
    stateMachine.setState("playing");
  }

  /**
   * 暂停播放（严格限制：playing → paused）
   */
  function onPause(): void {
    if (!stateMachine.canPause) {
      logger.warn(`Cannot pause in state: ${stateMachine.getState()}`);
      return;
    }
    const strategy = getStrategy();
    strategy?.pausePlayback();
    stateMachine.setState("paused");
    engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
    // MIDI 模式：暂停流体渲染，防止空转导致帧率下降
    if (strategy?.managesFluid) {
      engineRef.value?.setFluidPaused(true);
    }
  }

  /**
   * 停止播放（严格限制：playing/paused → ready）
   */
  function onStop(): void {
    if (!stateMachine.canStop) {
      logger.warn(`Cannot stop in state: ${stateMachine.getState()}`);
      return;
    }
    const strategy = getStrategy();
    strategy?.stopPlayback();
    currentTime.value = 0;
    stateMachine.setState("ready");
    engineRef.value?.stopAllSounds();
    engineRef.value?.noteBlockSystemRef.clearBlocks();
    engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
    // MIDI 模式：暂停流体（不销毁，避免重新播放时无法恢复）
    if (strategy?.managesFluid) {
      engineRef.value?.setFluidPaused(true);
    }
  }

  /**
   * 跳转到指定时间位置
   */
  function onSeek(seconds: number): void {
    const strategy = getStrategy();
    strategy?.seekTo(seconds);
    currentTime.value = seconds;
    engineRef.value?.noteBlockSystemRef.setTransportTime(seconds);
  }

  /**
   * 设置参与播放的轨道索引，并刷新时长
   */
  function onSelectTracks(indices: number[]): void {
    selectedTracks.value = indices;
    if (player) {
      player.setSelectedTracks(indices);
      duration.value = player.getDuration();
    }
  }

  /**
   * 设置播放速度倍率并持久化到 store
   */
  function onSetSpeed(speed: number): void {
    store.updateSetting("midiFile", "playbackSpeed", speed);
    if (player) player.setPlaybackSpeed(speed);
  }

  /**
   * 切换循环播放并持久化到 store
   */
  function onToggleLoop(): void {
    const next = !store.settings.midiFile.loop;
    store.updateSetting("midiFile", "loop", next);
    if (player) player.setLoop(next);
  }

  /**
   * 引擎就绪后的初始化：恢复本地缓存的录音数据
   *
   * 注意：由于子组件 onMounted 先于父组件，引擎 ready 事件触发时
   * recorder 可能尚未创建，此处通过 if 守卫保证安全。
   */
  function onEngineInit(): void {
    if (recorder) {
      const saved = recorder.loadFromStorage();
      if (saved.length > 0) {
        recorder.loadNotes(saved);
        duration.value = recorder.getDuration();
      }
    }
  }

  // ── 播放源与实时 MIDI 输入的挂载/卸载 ──
  // onProgress 节流：引擎 setTransportTime 每帧必须调用（状态同步），
  // 但 Vue ref 写入节流至 10Hz，避免 60fps 重渲染风暴
  let lastRefSyncTime = 0;
  const REF_SYNC_INTERVAL = 100; // 10Hz

  function throttledProgressSync(current: number, dur: number): void {
    engineRef.value?.noteBlockSystemRef.setTransportTime(current);
    const now = performance.now();
    if (now - lastRefSyncTime >= REF_SYNC_INTERVAL) {
      lastRefSyncTime = now;
      currentTime.value = current;
      if (dur > 0) duration.value = dur;
    }
  }

  onMounted(() => {
    player = new MidiFilePlayer();
    player.setCallbacks({
      onProgress: throttledProgressSync,
      onScheduledNotesReady: (notes) => {
        logger.info(`Scheduled notes ready: ${notes.length}`);
        engineRef.value?.noteBlockSystemRef.scheduleSynthesiaNotes(notes);
      },
      onTracksReady: (t) => {
        tracks.value = t;
        if (selectedTracks.value.length === 0 && t.length > 0) {
          selectedTracks.value = t.map((tr) => tr.index);
        }
      },
      onPlaybackEnd: () => {
        currentTime.value = 0;
        stateMachine.setState("ready");
        engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
        engineRef.value?.setFluidPaused(true);
      },
      onSyncTime: (time) => {
        logger.debug(`Syncing note blocks to time: ${time.toFixed(2)}s`);
        engineRef.value?.noteBlockSystemRef.syncToTime(time);
      },
    });

    recorder = new Recorder();
    recorderRef.value = recorder;
    recorder.setCallbacks({
      onProgress: throttledProgressSync,
      onScheduledNotesReady: (notes) => {
        engineRef.value?.noteBlockSystemRef.scheduleSynthesiaNotes(notes);
      },
      onPlaybackEnd: () => {
        currentTime.value = 0;
        stateMachine.setState("ready");
        engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
      },
    });

    useRealtimeMidi(engineRef, recorderRef, isRecording, {
      onSustain: (enabled) => {
        engineRef.value?.setSustain(enabled);
      },
    });

    // 初始化左右手轨道索引推断配置
    player.setHandTrackIndices({
      right: store.settings.midiFile.rightHandTrackIdx,
      left: store.settings.midiFile.leftHandTrackIdx,
    });
  });

  // 监听左右手轨道索引变化，同步到 player
  watch(
    () => [
      store.settings.midiFile.rightHandTrackIdx,
      store.settings.midiFile.leftHandTrackIdx,
    ],
    ([right, left]) => {
      player?.setHandTrackIndices({ right, left });
    },
  );

  onUnmounted(() => {
    player?.dispose();
    recorder?.dispose();
    player = null;
    recorder = null;
  });

  return {
    contentType,
    isRecording,
    currentTime,
    duration,
    fileName,
    tracks,
    selectedTracks,
    getStrategy,
    onEngineInit,
    onCanvasNoteOn,
    onCanvasNoteOff,
    onLoadMidi,
    onToggleRecord,
    onPlay,
    onPause,
    onStop,
    onSeek,
    onSelectTracks,
    onSetSpeed,
    onToggleLoop,
  };
}
