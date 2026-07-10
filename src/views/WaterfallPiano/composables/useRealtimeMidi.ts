import type { Ref } from "vue";
import { useMidiMessage } from "@/composables/useMidiMessage";
import { MIDI_NAMESPACE } from "../constants";
import type { WaterfallEngine } from "../engine/WaterfallEngine";
import type { Recorder } from "../audio/Recorder";

export interface RealtimeMidiOptions {
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
  onSustain?: (enabled: boolean) => void;
  onControlChange?: (controller: number, value: number) => void;
}

export function useRealtimeMidi(
  engine: Ref<WaterfallEngine | null>,
  recorder: Ref<Recorder | null>,
  isRecording: Ref<boolean>,
  options?: RealtimeMidiOptions,
): void {
  const handler = (message: number[]): void => {
    if (message.length < 2) return;
    const status = message[0] & 0xf0;
    const midi = message[1];
    const velocity = message[2] ?? 0;

    if (status === 0x90 && velocity > 0) {
      engine.value?.triggerNoteOn(midi, velocity);
      if (isRecording.value) recorder.value?.recordNoteOn(midi, velocity);
      options?.onNoteOn?.(midi, velocity);
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      engine.value?.triggerNoteOff(midi);
      if (isRecording.value) recorder.value?.recordNoteOff(midi);
      options?.onNoteOff?.(midi);
    } else if (status === 0xb0 && message.length >= 3) {
      const controller = message[1];
      const value = message[2];
      if (controller === 64) {
        options?.onSustain?.(value >= 64);
      }
      options?.onControlChange?.(controller, value);
    }
  };

  useMidiMessage(handler, MIDI_NAMESPACE);
}
