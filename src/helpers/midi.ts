export type MidiMessage = [number, number, number];

export const getMidiCommand = (m: MidiMessage | number[]) => (m[0] >> 4) << 4;

export const getMidiChannel = (m: MidiMessage | number[]) => (m[0] & 0xf) + 1;

export const getMidiNote = (m: MidiMessage | number[]) => m[1];

export const getMidiValue = (m: MidiMessage | number[]) => m[2];

export const getMidiMultiWordValue = (m: MidiMessage | number[]) =>
  m[2] * 128 + m[1];
