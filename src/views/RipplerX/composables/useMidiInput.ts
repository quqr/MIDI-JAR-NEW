import { ref, onMounted, onUnmounted } from "vue";
import { useMidiMessagesStore } from "@/stores/midiMessages";
import { createMidiHandler, type MidiMessageHandlers } from "@/composables/useMidiHandler";
import type { useModalSynth } from "./useModalSynth";

const MIDI_NAMESPACE = "ripplerx";

// ── QWERTY keyboard → MIDI note mapping (bottom row = C3, middle row, top row) ──
const KEY_NOTE_MAP: Record<string, number> = {
  // Bottom row (z=48/C3 ...)
  z: 48, s: 49, x: 50, d: 51, c: 52, v: 53, g: 54, b: 55, h: 56, n: 57, j: 58, m: 59,
  // Top row (q=60/C4 ...)
  q: 60, "2": 61, w: 62, "3": 63, e: 64, r: 65, "5": 66, t: 67, "6": 68, y: 69, "7": 70, u: 71,
  // Extension (i=72/C5 ...)
  i: 72, "9": 73, o: 74, "0": 75, p: 76,
};

const DEFAULT_VELOCITY = 100;

export function useMidiInput(modalSynth: ReturnType<typeof useModalSynth>) {
  const isKeyboardEnabled = ref(true);
  const playedNotes = ref<number[]>([]);
  const sustainedNotes = ref<number[]>([]);

  // ── Hardware MIDI ──
  const handlers: MidiMessageHandlers = {
    onNoteOn(midi: number) {
      // Velocity comes from the raw message; we use a default since the
      // handler API from useMidiHandler only passes the note number.
      // A more complete implementation would parse velocity from the raw message.
      modalSynth.noteOn(midi, DEFAULT_VELOCITY);
      addPlayedNote(midi);
    },
    onNoteOff(midi: number) {
      modalSynth.noteOff(midi);
      removePlayedNote(midi);
    },
    onSustainOn() {
      modalSynth.setSustain(true);
    },
    onSustainOff() {
      modalSynth.setSustain(false);
      sustainedNotes.value = [];
    },
  };

  const midiHandler = createMidiHandler(0, handlers); // channel 0 = all channels

  // ── Keyboard input ──
  const activeKeyNotes = new Map<string, number>(); // key → midi note

  function onKeyDown(e: KeyboardEvent) {
    if (!isKeyboardEnabled.value) return;
    // Ignore repeat events and modifier-only keys
    if (e.repeat) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const key = e.key.toLowerCase();
    const note = KEY_NOTE_MAP[key];
    if (note === undefined) return;

    e.preventDefault();
    if (activeKeyNotes.has(key)) return; // already pressed

    activeKeyNotes.set(key, note);
    modalSynth.noteOn(note, DEFAULT_VELOCITY);
    addPlayedNote(note);
  }

  function onKeyUp(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    const note = activeKeyNotes.get(key);
    if (note === undefined) return;

    activeKeyNotes.delete(key);
    modalSynth.noteOff(note);
    removePlayedNote(note);
  }

  // ── Played notes tracking ──
  function addPlayedNote(midi: number) {
    if (!playedNotes.value.includes(midi)) {
      playedNotes.value = [...playedNotes.value, midi];
    }
  }

  function removePlayedNote(midi: number) {
    playedNotes.value = playedNotes.value.filter((n) => n !== midi);
  }

  // ── Lifecycle ──
  let unsubscribeFn: (() => void) | null = null;

  onMounted(async () => {
    // Subscribe to MIDI messages from the store
    const store = useMidiMessagesStore();
    const handler = (message: number[], _timestamp: number, _device: string) => {
      midiHandler(message);
    };
    await store.subscribeToNamespace(MIDI_NAMESPACE, handler);
    unsubscribeFn = () => store.unsubscribeFromNamespace(MIDI_NAMESPACE, handler);

    // Keyboard listeners
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
  });

  onUnmounted(() => {
    unsubscribeFn?.();
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);

    // Release any still-held keyboard notes
    for (const [, note] of activeKeyNotes) {
      modalSynth.noteOff(note);
    }
    activeKeyNotes.clear();
    playedNotes.value = [];
  });

  return {
    isKeyboardEnabled,
    playedNotes,
    sustainedNotes,
  };
}
