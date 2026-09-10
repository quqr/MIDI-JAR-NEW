import { computed, ref } from "vue";
import { useSamplerService, useScalePlayer } from "@/composables";
import { useSamplerStore } from "@/stores";
import { chordToMidi, type KeyMode } from "./circleOfFifths";

/** 当前在响的对象 */
export type PlayingTarget =
  | { kind: "scale"; tonic: string; mode: KeyMode }
  | { kind: "chord"; symbol: string };

/**
 * 五度循环圈的试听编排。
 *
 * - 音阶复用 `useScalePlayer`（已支持大小调、带运行令牌可中断）；
 * - 和弦直接调采样器，音高一律走 MIDI 数字以绕开 `E#` / `B#` 拼写；
 * - 维护「在响什么」与「音阶播到第几个音」两个状态，供可视化同步。
 */
export function useCircleAudio() {
  const scalePlayer = useScalePlayer();
  const sampler = useSamplerService();
  const samplerStore = useSamplerStore();

  /** 当前在响的对象；null 表示空闲 */
  const playing = ref<PlayingTarget | null>(null);
  /** 音阶播放中当前音的序号（-1 表示未在播音阶） */
  const scaleNoteIndex = ref(-1);
  /** 没有已加载的音源时置位，供 UI 提示先去采样器加载 */
  const needsInstrument = ref(false);

  /** 运行令牌：新的播放作废旧的回调 */
  let token = 0;

  /** 音源是否可用（响应式，用于置灰试听入口） */
  const instrumentReady = computed(() => samplerStore.isReady);

  function playScale(tonic: string, mode: KeyMode): void {
    const current = ++token;
    sampler.stopAllNotes();
    playing.value = { kind: "scale", tonic, mode };
    scaleNoteIndex.value = -1;

    void scalePlayer
      .playScale({
        key: tonic,
        mode,
        direction: "both",
        duration: 340,
        onNote: ({ index }) => {
          if (current !== token) return;
          scaleNoteIndex.value = index;
        },
      })
      .then(() => {
        if (current !== token) return;
        playing.value = null;
        scaleNoteIndex.value = -1;
      });
  }

  function playChord(symbol: string): void {
    const midiNotes = chordToMidi(symbol);
    if (!midiNotes.length) return;

    const current = ++token;
    scalePlayer.stopScale();

    const stops = midiNotes.map((midi) => sampler.playNote(midi, 88, 1.4));
    // 采样器没有活动音源时 playNote 恒返回 null——据此提示用户去加载音色
    if (stops.every((stop) => stop === null)) {
      needsInstrument.value = true;
      playing.value = null;
      return;
    }

    needsInstrument.value = false;
    playing.value = { kind: "chord", symbol };

    window.setTimeout(() => {
      if (current !== token) return;
      if (playing.value?.kind === "chord") playing.value = null;
    }, 1400);
  }

  /** 停止一切发声与在途回调 */
  function stop(): void {
    token += 1;
    scalePlayer.stopScale();
    sampler.stopAllNotes();
    playing.value = null;
    scaleNoteIndex.value = -1;
  }

  /** 该调性是否正在试听 */
  function isPlayingKey(tonic: string, mode: KeyMode): boolean {
    return (
      playing.value?.kind === "scale" &&
      playing.value.tonic === tonic &&
      playing.value.mode === mode
    );
  }

  /** 该和弦是否正在试听 */
  function isPlayingChord(symbol: string): boolean {
    return playing.value?.kind === "chord" && playing.value.symbol === symbol;
  }

  return {
    playing,
    scaleNoteIndex,
    needsInstrument,
    instrumentReady,
    playScale,
    playChord,
    stop,
    isPlayingKey,
    isPlayingChord,
  };
}
