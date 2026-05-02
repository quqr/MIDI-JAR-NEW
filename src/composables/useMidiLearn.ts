import { ref, onUnmounted } from "vue";
import { JZZEngine } from "@/midi/JZZEngine";
import jzz from "jzz";

export function useMidiLearn(
  onLearn: (note: number) => void,
  channel: number | null = null,
) {
  const isLearning = ref(false);
  const learnedNote = ref<number | null>(null);
  const port = ref<any>(null);

  const handleMessage = (msg: any) => {
    if (!isLearning.value) return;

    const data = Array.from(msg) as number[];
    const status = data[0] as number;
    const note = data[1] as number;
    const velocity = data[2] as number;

    if ((status & 0xf0) === 0x90 && velocity > 0) {
      const msgChannel = status & 0x0f;

      if (channel === null || msgChannel === channel) {
        learnedNote.value = note;
        onLearn(note);
        stopLearning();
      }
    }
  };

  async function startLearning() {
    if (isLearning.value) return;
    isLearning.value = true;

    try {
      const engine = JZZEngine.getInstance();
      if (!engine.isInitialized()) {
        console.warn("JZZ engine not initialized");
        isLearning.value = false;
        return;
      }

      const jzzEngine = jzz();
      const inputs = jzzEngine.info().inputs;

      if (inputs.length === 0) {
        console.warn("No MIDI input devices available");
        isLearning.value = false;
        return;
      }

      port.value = await new Promise((resolve, reject) => {
        jzz()
          .openMidiIn(inputs[0].name)
          .or(function () {
            reject(new Error(this._err ? this._err() : "Unknown JZZ error"));
          })
          .and(function () {
            resolve(this);
          });
      });
      port.value.connect(handleMessage);
    } catch (err) {
      console.error("Failed to open MIDI input:", err);
      isLearning.value = false;
    }
  }

  function stopLearning() {
    isLearning.value = false;
    if (port.value) {
      port.value.disconnect(handleMessage);
      port.value.close();
      port.value = null;
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
