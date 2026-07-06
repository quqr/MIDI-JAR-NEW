export type MidiMessage = [number, number, number];

/** MIDI status byte range (0x80-0xFF): upper nibble = command, lower nibble = channel */
export const getMidiCommand = (m: MidiMessage | number[]): number =>
  m.length > 0 ? (m[0] >> 4) << 4 : 0;

/** MIDI channel (1-16) extracted from the status byte */
export const getMidiChannel = (m: MidiMessage | number[]): number =>
  m.length > 0 ? (m[0] & 0xf) + 1 : 1;

/** MIDI note number (0-127), returns 0 if message is too short */
export const getMidiNote = (m: MidiMessage | number[]): number =>
  m.length > 1 ? (m[1] ?? 0) : 0;

/** MIDI velocity / controller value (0-127), returns 0 if message is too short */
export const getMidiValue = (m: MidiMessage | number[]): number =>
  m.length > 2 ? (m[2] ?? 0) : 0;

/** Decode a 14-bit MIDI value from two data bytes (MSB first) */
export const getMidiMultiWordValue = (m: MidiMessage | number[]): number =>
  m.length > 2 ? m[2] * 128 + (m[1] ?? 0) : 0;
