import {
  getMidiChannel,
  getMidiCommand,
  getMidiNote,
  getMidiValue,
} from "@/helpers";

const MIDI_CMD_NOTE_OFF = 0x80;
const MIDI_CMD_NOTE_ON = 0x90;
export const MIDI_CHANNEL_ALL = 0;
const MIDI_CMD_CC = 0xb0;
const MIDI_CC_SUSTAIN = 0x40;

export interface MidiMessageHandlers {
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
  onSustainOn: () => void;
  onSustainOff: () => void;
}

function isNoteOn(
  cmd: number,
  value: number,
  midiChannel: number,
  ch: number,
): boolean {
  return (
    cmd === MIDI_CMD_NOTE_ON &&
    value !== 0 &&
    (midiChannel === MIDI_CHANNEL_ALL || midiChannel === ch)
  );
}

function isNoteOff(
  cmd: number,
  value: number,
  midiChannel: number,
  ch: number,
): boolean {
  return (
    (cmd === MIDI_CMD_NOTE_OFF ||
      (cmd === MIDI_CMD_NOTE_ON && value === 0)) &&
    (midiChannel === MIDI_CHANNEL_ALL || midiChannel === ch)
  );
}

function isSustainCC(
  cmd: number,
  midi: number,
  midiChannel: number,
  ch: number,
): boolean {
  return (
    cmd === MIDI_CMD_CC &&
    midi === MIDI_CC_SUSTAIN &&
    (midiChannel === MIDI_CHANNEL_ALL || midiChannel === ch)
  );
}

export function createMidiHandler(
  midiChannel: number,
  handlers: MidiMessageHandlers,
) {
  return (message: number[]) => {
    const cmd = getMidiCommand(message);
    const ch = getMidiChannel(message);
    const midi = getMidiNote(message);
    const value = getMidiValue(message);

    if (isNoteOn(cmd, value, midiChannel, ch)) {
      handlers.onNoteOn(midi);
    }

    if (isNoteOff(cmd, value, midiChannel, ch)) {
      handlers.onNoteOff(midi);
    }

    if (isSustainCC(cmd, midi, midiChannel, ch)) {
      if (value === 0) {
        handlers.onSustainOff();
      }
      if (value === 127) {
        handlers.onSustainOn();
      }
    }
  };
}
