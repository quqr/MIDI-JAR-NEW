import { ref, onUnmounted } from "vue";
import {
  InternalMidiMessages,
  MidiMessageEvent,
} from "@/midi/MidiMessageManager";
import { MIDI_CHANNEL_ALL } from "./useMidiHandler";

const MIDI_CMD_NOTE_ON = 0x90;

/**
 * MIDI Learn 功能：监听下一个 MIDI 音符并回调通知，用于将控件绑定到 MIDI 音符。
 *
 * @param midiManager - 内部 MIDI 消息管理器实例，为 null 时无法开始学习
 * @param onLearn - 学习到音符时的回调，接收 MIDI 音符编号
 * @param channel - 限制监听的 MIDI 通道，默认监听所有通道
 * @returns 学习状态、已学习音符及控制方法
 */
export function useMidiLearn(
  midiManager: InternalMidiMessages | null,
  onLearn: (note: number) => void,
  channel: number = MIDI_CHANNEL_ALL,
) {
  const isLearning = ref(false);
  const learnedNote = ref<number | null>(null);

  function handleMessage(event: MidiMessageEvent) {
    if (!isLearning.value) return;

    const message = event.message;
    const status = message[0] as number;
    const note = message[1] as number;
    const velocity = message[2] as number;

    if ((status & 0xf0) === MIDI_CMD_NOTE_ON && velocity > 0) {
      const msgChannel = (status & 0x0f) + 1;
      if (channel === MIDI_CHANNEL_ALL || msgChannel === channel) {
        learnedNote.value = note;
        onLearn(note);
        stopLearning();
      }
    }
  }

  function startLearning() {
    if (isLearning.value) return;
    if (!midiManager) return;

    isLearning.value = true;
    midiManager.addEventListener("message", handleMessage);
  }

  function stopLearning() {
    isLearning.value = false;
    if (midiManager) {
      midiManager.removeEventListener("message", handleMessage);
    }
  }

  onUnmounted(() => {
    stopLearning();
  });

  return {
    isLearning,
    learnedNote,
    startLearning,
    stopLearning,
  };
}

export default useMidiLearn;
