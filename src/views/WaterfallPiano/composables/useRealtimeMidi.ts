import { useMidiMessage } from "@/composables/useMidiMessage";
import {
  getMidiCommand,
  getMidiNote,
  getMidiValue,
} from "@/helpers/midi";

// MIDI 命令码（与 useNotes.ts 保持一致）
const MIDI_CMD_NOTE_ON = 0x90;
const MIDI_CMD_NOTE_OFF = 0x80;
const MIDI_CMD_CC = 0xb0;
const MIDI_CC_SUSTAIN = 0x40;

export interface UseRealtimeMidiOptions {
  namespace?: string;
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
  onSustain?: (enabled: boolean) => void;
}

/**
 * 实时 MIDI 订阅 Composable
 *
 * 监听 `chord-display/default` namespace 的 MIDI 消息，
 * 解析 note-on（带真实 velocity）、note-off、CC64（延音踏板），
 * 转发到 WaterfallEngine 的实时演奏接口。
 *
 * 不改动 sidecar —— MidiMessageManager 已在 Tauri 环境中自动连接。
 */
export function useRealtimeMidi(options: UseRealtimeMidiOptions = {}) {
  const {
    namespace = "chord-display/default",
    onNoteOn,
    onNoteOff,
    onSustain,
  } = options;

  useMidiMessage((message: number[]) => {
    const cmd = getMidiCommand(message);
    const midi = getMidiNote(message);
    const value = getMidiValue(message);

    // Note-on (velocity ≠ 0) → 带真实力度
    if (cmd === MIDI_CMD_NOTE_ON && value !== 0) {
      onNoteOn?.(midi, value);
    }

    // Note-off 或 Note-on velocity=0
    if (cmd === MIDI_CMD_NOTE_OFF || (cmd === MIDI_CMD_NOTE_ON && value === 0)) {
      onNoteOff?.(midi);
    }

    // CC64 延音踏板
    if (cmd === MIDI_CMD_CC && midi === MIDI_CC_SUSTAIN) {
      onSustain?.(value !== 0);
    }
  }, namespace);
}
