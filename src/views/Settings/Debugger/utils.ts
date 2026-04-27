import { MidiMessage } from "@/helpers";
import { MIDI_CMD, MIDI_CC } from "./constants";

export function getMidiCommand(m: MidiMessage): number {
  return m[0] & 0xf0;
}

export function getMidiChannel(m: MidiMessage): number {
  return (m[0] & 0x0f) + 1;
}

export function getMidiNote(m: MidiMessage): number {
  return m[1];
}

export function getMidiValue(m: MidiMessage): number {
  return m[2];
}

export function getMidiMultiWordValue(m: MidiMessage): number {
  return (m[2] << 7) | m[1];
}

export function formatMidiMessage(m: MidiMessage): string {
  const cmd = getMidiCommand(m);
  const ch = getMidiChannel(m);
  const note = getMidiNote(m);
  const value = getMidiValue(m);

  if (cmd === 0xb0) {
    const cc = note as keyof typeof MIDI_CC;
    return `channel ${ch} - ${cmd}:${MIDI_CMD[cmd] ?? "Unknown"}  - CC ${cc} ${MIDI_CC[cc] ?? "Unknown"} - ${value}`;
  }
  if (cmd === 0xc0) {
    return `channel ${ch} - ${cmd}:${MIDI_CMD[cmd] ?? "Unknown"}  - program ${note}`;
  }
  if (cmd === 0xd0) {
    return `channel ${ch} - ${cmd}:${MIDI_CMD[cmd] ?? "Unknown"}  - pressure ${note}`;
  }
  if (cmd === 0xe0) {
    const pitch = getMidiMultiWordValue(m);
    return `channel ${ch} - ${cmd}:${MIDI_CMD[cmd] ?? "Unknown"}  - pitch ${pitch}`;
  }
  if (cmd === 0xf0) {
    const fCmd = m[0] as keyof typeof MIDI_CMD;
    if (m[0] === 0xf2) {
      return `${m[0]}:${MIDI_CMD[fCmd] ?? "Unknown"} - position ${getMidiMultiWordValue(m)}`;
    }
    return `${m[0]}:${MIDI_CMD[fCmd] ?? "Unknown"}${note ? ` - ${note}` : ""}${value ? ` - ${value}` : ""}`;
  }

  return `channel ${ch} - ${cmd}:${MIDI_CMD[cmd] ?? "Unknown"} - note ${note} - ${value} `;
}
