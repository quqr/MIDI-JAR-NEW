import { onUnmounted, ref, shallowRef } from "vue";
import { Midi } from "@tonejs/midi";
import { buildTempoMap } from "@/views/ScoreScroll/utils/beatMap";
import { MidiFilePlayer } from "@/views/WaterfallPiano/midi/MidiFilePlayer";
import { SamplerSoundEngine } from "@/views/WaterfallPiano/audio/SamplerSoundEngine";
import { Score3dEngine } from "../engine/Score3dEngine";
import { TrailStrategy } from "../engine/TrailStrategy";
import { layoutTrail } from "../engine/layoutTrail";
import { toScore3dNotes } from "../engine/noteMapper";
import {
  DEFAULT_ENVELOPE_PARAMS,
  DEFAULT_GLOW_PARAMS,
  DEFAULT_LAYOUT_OPTIONS,
} from "../constants";
import type { Score3dPlaybackState, TrackInfo } from "../types";

/**
 * 三维乐谱引擎生命周期与播放状态管理 composable。
 *
 * - 数据：@tonejs/midi 解析 → noteMapper → layoutTrail → TrailStrategy
 * - 时间轴/音频：复用 MidiFilePlayer + SamplerSoundEngine（与 ScoreScroll 同款接线）
 * - 分组键：非空轨 ≤ 1 时回退 channel 分组（格式 0 单轨文件）
 */
export function useScore3dEngine() {
  const engineRef = shallowRef<Score3dEngine | null>(null);
  const state = ref<Score3dPlaybackState>("idle");
  const currentTime = ref(0);
  const duration = ref(0);
  const trackInfos = ref<TrackInfo[]>([]);
  const loaded = ref(false);
  const loading = ref(false);

  let player: MidiFilePlayer | null = null;
  let soundEngine: SamplerSoundEngine | null = null;
  const visibleTracks = ref<Set<number>>(new Set());

  function onEngineReady(engine: Score3dEngine): void {
    engineRef.value = engine;
    engine.frameCallback = () => {
      if (state.value === "playing" && player) {
        const t = player.getCurrentTime();
        currentTime.value = t;
        return t;
      }
      return currentTime.value;
    };
  }

  async function load(file: File): Promise<void> {
    const engine = engineRef.value;
    if (!engine || loading.value) return;
    loading.value = true;
    try {
      const buffer = await file.arrayBuffer();
      const midi = new Midi(buffer);

      const nonEmptyCount = midi.tracks.filter((t) => t.notes.length > 0).length;
      const groupBy = nonEmptyCount <= 1 ? "channel" : "track";
      const tempoMap = buildTempoMap(
        midi.header.tempos.map((t) => ({
          ticks: t.ticks,
          bpm: t.bpm,
          time: t.time,
        })),
        midi.header.ppq,
      );
      const input = midi.tracks.map((t) => ({
        channel: t.channel,
        notes: t.notes,
      }));
      const { notes, tracks: infos, duration: total } = toScore3dNotes(input, {
        groupBy,
        tempoMap,
      });
      const trailTracks = layoutTrail(notes, DEFAULT_LAYOUT_OPTIONS);

      engine.setStrategy(
        new TrailStrategy(trailTracks, notes, {
          layout: DEFAULT_LAYOUT_OPTIONS,
          glow: DEFAULT_GLOW_PARAMS,
          envelope: DEFAULT_ENVELOPE_PARAMS,
          anchorWindow: 0.15,
          cameraOffset: { x: -6, y: 4, z: 10 },
        }),
      );
      engine.frameCallback = () => {
        if (state.value === "playing" && player) {
          const t = player.getCurrentTime();
          currentTime.value = t;
          return t;
        }
        return currentTime.value;
      };

      trackInfos.value = infos;
      visibleTracks.value = new Set(infos.map((i) => i.trackIndex));
      for (const info of infos) engine.setTrackVisible(info.trackIndex, true);

      // 播放器（时间轴 + 音频）
      stop();
      if (!soundEngine) {
        soundEngine = new SamplerSoundEngine();
        void soundEngine.init();
      }
      player = new MidiFilePlayer();
      player.callbacks = {
        onNoteOn: (m, v) => void soundEngine?.noteOn(m, v),
        onNoteOff: (m) => soundEngine?.noteOff(m),
        onProgress: (cur, dur) => {
          currentTime.value = cur;
          duration.value = dur;
        },
        onPlaybackEnd: () => {
          state.value = "idle";
        },
      };
      await player.loadFile(file);
      duration.value = player.getDuration();

      currentTime.value = 0;
      state.value = "idle";
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  function play(): void {
    if (!player || !loaded.value) return;
    if (state.value !== "playing") {
      player.startPlayback();
      state.value = "playing";
    }
  }

  function pause(): void {
    if (state.value !== "playing") return;
    player?.pausePlayback();
    state.value = "paused";
  }

  function stop(): void {
    player?.stopPlayback();
    state.value = "idle";
    currentTime.value = 0;
  }

  function seek(time: number): void {
    if (!player || !loaded.value) return;
    const clamped = Math.min(Math.max(0, time), duration.value);
    player.seekTo(clamped);
    currentTime.value = clamped;
    if (state.value === "playing") {
      // seek 后保持播放：EventScheduler 游标已由 seekTo 重置
      player.startPlayback();
    }
  }

  function setTrackVisible(trackIndex: number, visible: boolean): void {
    if (visible) {
      visibleTracks.value.add(trackIndex);
    } else {
      visibleTracks.value.delete(trackIndex);
    }
    // 触发 Set 的响应式更新
    visibleTracks.value = new Set(visibleTracks.value);
    engineRef.value?.setTrackVisible(trackIndex, visible);
  }

  onUnmounted(() => {
    player?.stopPlayback();
    player = null;
    soundEngine?.dispose();
    soundEngine = null;
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
