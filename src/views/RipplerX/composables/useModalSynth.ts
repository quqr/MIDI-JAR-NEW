import { ref, readonly, onUnmounted } from "vue";
import { createLogger } from "@/utils/logger";
import { useRipplerXStore, type RipplerXState } from "../stores/ripplerx";

const logger = createLogger("useModalSynth");

export interface ModalSynthState {
  isInitialized: boolean;
  activeVoices: number;
  rmsLevel: number;
  cpuUsage: number;
  currentPreset: string;
}

const WORKLET_URL = "/modal-synth-processor.js";

export function useModalSynth() {
  const store = useRipplerXStore();

  const isInitialized = ref(false);
  const activeVoices = ref(0);
  const rmsLevel = ref(0);
  const cpuUsage = ref(0);

  let audioContext: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let analyserNode: AnalyserNode | null = null;
  let gainNode: GainNode | null = null;

  // Active voices tracking (for note-on/note-off without worklet voice mgmt)
  const activeNotes = new Map<number, number>(); // midi → velocity

  // Sustain pedal
  let sustainActive = false;
  const sustainedNotes = new Set<number>();

  // RMS metering
  let rmsAnimFrame: number | null = null;
  const rmsBuffer = new Uint8Array(256);

  function startRmsMetering() {
    if (!analyserNode) return;
    const analyser = analyserNode;

    const tick = () => {
      analyser.getByteTimeDomainData(rmsBuffer);
      let sum = 0;
      for (let i = 0; i < rmsBuffer.length; i++) {
        const v = (rmsBuffer[i] - 128) / 128;
        sum += v * v;
      }
      rmsLevel.value = Math.sqrt(sum / rmsBuffer.length);
      rmsAnimFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopRmsMetering() {
    if (rmsAnimFrame !== null) {
      cancelAnimationFrame(rmsAnimFrame);
      rmsAnimFrame = null;
    }
  }

  /**
   * Initialise the AudioContext, load the AudioWorklet module, create the node
   * and set up message handlers.
   */
  async function init(): Promise<void> {
    if (isInitialized.value) return;

    try {
      audioContext = new AudioContext();

      await audioContext.audioWorklet.addModule(WORKLET_URL);

      workletNode = new AudioWorkletNode(audioContext, "modal-synth", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      // Gain node for volume control
      gainNode = audioContext.createGain();
      gainNode.gain.value = store.state.gain.gain;

      // Analyser node for VU meter
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;

      // Connect: Worklet → Gain → Analyser → Destination
      workletNode.connect(gainNode);
      gainNode.connect(analyserNode);
      analyserNode.connect(audioContext.destination);

      // Handle messages from the worklet
      workletNode.port.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === "initialized") {
          logger.info("AudioWorklet initialized", msg.sampleRate);
        } else if (msg.type === "status") {
          cpuUsage.value = parseFloat(msg.utilization);
        } else if (msg.type === "triggered") {
          activeVoices.value++;
        }
      };

      // Initialise the worklet processor
      workletNode.port.postMessage({
        type: "init",
        sampleRate: audioContext.sampleRate,
      });

      // Apply current store params
      syncAllParams();

      startRmsMetering();
      isInitialized.value = true;
      logger.info("Modal synth initialized");
    } catch (err) {
      logger.error("Failed to initialize modal synth: %s", err);
      throw err;
    }
  }

  /**
   * Send a note-on to the worklet
   */
  function noteOn(note: number, velocity: number): void {
    if (!workletNode || !isInitialized.value) return;

    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioContext?.state === "suspended") {
      audioContext.resume();
    }

    activeNotes.set(note, velocity);

    // Send note-on to AudioWorklet (it handles frequency calculation internally)
    workletNode.port.postMessage({
      type: "noteOn",
      note,
      velocity,
    });

    // Set gain parameter in real-time
    if (workletNode.parameters) {
      const gainParam = workletNode.parameters.get("gain");
      if (gainParam) {
        gainParam.setValueAtTime(store.state.gain.gain, audioContext?.currentTime ?? 0);
      }
    }
  }

  /**
   * Send a note-off. With the current prototype worklet this is mostly
   * for tracking; the resonator naturally decays.
   */
  function noteOff(note: number): void {
    if (sustainActive) {
      sustainedNotes.add(note);
      return;
    }
    activeNotes.delete(note);

    if (workletNode && isInitialized.value) {
      workletNode.port.postMessage({
        type: "noteOff",
        note,
      });
    }

    activeVoices.value = Math.max(0, activeVoices.value - 1);
  }

  /**
   * Update a single parameter on the AudioWorklet in real-time.
   */
  function setParam(id: string, value: number): void {
    if (!workletNode || !isInitialized.value) return;

    // Continuous params via AudioParam
    if (workletNode.parameters?.has(id)) {
      const param = workletNode.parameters.get(id)!;
      param.setValueAtTime(value, audioContext?.currentTime ?? 0);
      return;
    }

    // Discrete params via MessagePort
    workletNode.port.postMessage({
      type: "setParam",
      id,
      value,
    });
  }

  /**
   * Push all current store parameters to the worklet.
   * Converts the store's structured params to the flat key-value format
   * expected by the AudioWorklet processor, and uses JSON round-trip to
   * strip Vue Proxy wrappers that cause DataCloneError.
   */
  function syncAllParams(): void {
    if (!workletNode) return;
    const s = store.state;

    // Build flat parameter map matching AudioWorklet's expected keys
    const params: Record<string, number> = {
      // Mallet
      mallet_type: s.mallet.type,
      mallet_pitch: s.mallet.pitch,
      mallet_filter: s.mallet.filter,
      mallet_mix: s.mallet.mix,
      mallet_res: s.mallet.resonance,
      mallet_stiff: s.mallet.stiffness,
      mallet_ktrack: s.mallet.keyTracking,
      // Resonator A
      a_on: s.resonatorA.on ? 1 : 0,
      a_model: s.resonatorA.model,
      a_partials: s.resonatorA.partials,
      a_decay: s.resonatorA.decay,
      a_damp: s.resonatorA.damp,
      a_tone: s.resonatorA.tone,
      a_hit: s.resonatorA.hit,
      a_rel: s.resonatorA.release,
      a_inharm: s.resonatorA.inharmonicity,
      a_ratio: s.resonatorA.ratio,
      a_cut: s.resonatorA.cut,
      a_radius: s.resonatorA.radius,
      // Resonator B
      b_on: s.resonatorB.on ? 1 : 0,
      b_model: s.resonatorB.model,
      b_partials: s.resonatorB.partials,
      b_decay: s.resonatorB.decay,
      b_damp: s.resonatorB.damp,
      b_tone: s.resonatorB.tone,
      b_hit: s.resonatorB.hit,
      b_rel: s.resonatorB.release,
      b_inharm: s.resonatorB.inharmonicity,
      b_ratio: s.resonatorB.ratio,
      b_cut: s.resonatorB.cut,
      b_radius: s.resonatorB.radius,
      // Noise
      noise_mix: s.noise.mix,
      noise_res: s.noise.resonance,
      noise_filter_freq: s.noise.frequency,
      noise_filter_q: s.noise.q,
      noise_filter_mode: s.noise.filterType,
      noise_att: s.noise.attack,
      noise_dec: s.noise.decay,
      noise_sus: s.noise.sustain,
      noise_rel: s.noise.release,
      noise_att_ten: s.noise.attackTension,
      noise_dec_ten: s.noise.decayTension,
      noise_rel_ten: s.noise.releaseTension,
      // Coupling
      couple: s.coupling.mode,
      ab_mix: s.coupling.mix,
      ab_split: s.coupling.split,
      // Pitch (resonator coarse/fine + pitch section combined)
      a_coarse: s.resonatorA.coarse + s.pitch.coarseA,
      a_fine: s.resonatorA.fine + s.pitch.fineA,
      b_coarse: s.resonatorB.coarse + s.pitch.coarseB,
      b_fine: s.resonatorB.fine + s.pitch.fineB,
      bend_range: s.pitch.bendRange,
      // Gain
      gain: s.gain.gain,
    };

    // JSON round-trip strips Vue Proxy wrappers
    workletNode.port.postMessage({
      type: "setParams",
      params: JSON.parse(JSON.stringify(params)),
    });

    // Set AudioParam-based values immediately
    if (workletNode.parameters) {
      const gainParam = workletNode.parameters.get("gain");
      if (gainParam) {
        gainParam.setValueAtTime(s.gain.gain, audioContext?.currentTime ?? 0);
      }
    }
  }

  /**
   * Load a built-in preset by name.
   */
  function loadPreset(name: string): void {
    store.loadPreset(name);
    // TODO: Once preset data (parameter maps) is available, apply all params
    // For now, sync what we have
    syncAllParams();
  }

  /**
   * Parse and load a .ripx file.
   * Format: 4-byte magic (0x21324356 LE) + 4-byte XML length (LE) + XML + null byte
   */
  async function loadRipxFile(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    // Verify magic number
    const magic = view.getUint32(0, true);
    if (magic !== 0x21324356) {
      throw new Error("Invalid .ripx file: bad magic number");
    }

    // Read XML length
    const xmlLength = view.getUint32(4, true);

    // Extract XML string
    const xmlBytes = new Uint8Array(buffer, 8, xmlLength);
    const xmlString = new TextDecoder("utf-8").decode(xmlBytes);

    // Parse XML and extract PARAM values
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");
    const params: Record<string, number> = {};
    doc.querySelectorAll("PARAM").forEach((node) => {
      const id = node.getAttribute("id");
      const value = parseFloat(node.getAttribute("value") || "0");
      if (id) params[id] = value;
    });

    logger.info("Loaded .ripx preset: %s with %d params", file.name, Object.keys(params).length);

    // Apply parsed params to the store (mapping from JUCE param IDs to store fields)
    applyRipxParams(params);
    syncAllParams();
  }

  /**
   * Map JUCE parameter IDs from .ripx to store state fields.
   * This is a best-effort mapping based on the known parameter list from the
   * PluginProcessor constructor.
   */
  function applyRipxParams(params: Record<string, number>): void {
    // Direct ID → {section, key} mapping
    const paramMap: Record<string, { section: keyof RipplerXState; key: string }> = {
      // Noise
      noise_mix: { section: "noise", key: "mix" },
      noise_resonance: { section: "noise", key: "resonance" },
      noise_frequency: { section: "noise", key: "frequency" },
      noise_q: { section: "noise", key: "q" },
      noise_attack: { section: "noise", key: "attack" },
      noise_decay: { section: "noise", key: "decay" },
      noise_sustain: { section: "noise", key: "sustain" },
      noise_release: { section: "noise", key: "release" },
      // Mallet
      mallet_mix: { section: "mallet", key: "mix" },
      mallet_resonance: { section: "mallet", key: "resonance" },
      mallet_stiffness: { section: "mallet", key: "stiffness" },
      mallet_pitch: { section: "mallet", key: "pitch" },
      mallet_filter: { section: "mallet", key: "filter" },
      mallet_key_tracking: { section: "mallet", key: "keyTracking" },
      // Resonator A
      resonator_a_on: { section: "resonatorA", key: "on" },
      resonator_a_decay: { section: "resonatorA", key: "decay" },
      resonator_a_damp: { section: "resonatorA", key: "damp" },
      resonator_a_tone: { section: "resonatorA", key: "tone" },
      resonator_a_hit: { section: "resonatorA", key: "hit" },
      resonator_a_release: { section: "resonatorA", key: "release" },
      resonator_a_inharm: { section: "resonatorA", key: "inharmonicity" },
      resonator_a_ratio: { section: "resonatorA", key: "ratio" },
      resonator_a_cut: { section: "resonatorA", key: "cut" },
      resonator_a_radius: { section: "resonatorA", key: "radius" },
      // Resonator B
      resonator_b_on: { section: "resonatorB", key: "on" },
      resonator_b_decay: { section: "resonatorB", key: "decay" },
      resonator_b_damp: { section: "resonatorB", key: "damp" },
      resonator_b_tone: { section: "resonatorB", key: "tone" },
      resonator_b_hit: { section: "resonatorB", key: "hit" },
      resonator_b_release: { section: "resonatorB", key: "release" },
      resonator_b_inharm: { section: "resonatorB", key: "inharmonicity" },
      resonator_b_ratio: { section: "resonatorB", key: "ratio" },
      resonator_b_cut: { section: "resonatorB", key: "cut" },
      resonator_b_radius: { section: "resonatorB", key: "radius" },
      // Coupling
      coupling_mix: { section: "coupling", key: "mix" },
      coupling_split: { section: "coupling", key: "split" },
      // Pitch
      pitch_coarse_a: { section: "pitch", key: "coarseA" },
      pitch_fine_a: { section: "pitch", key: "fineA" },
      pitch_coarse_b: { section: "pitch", key: "coarseB" },
      pitch_fine_b: { section: "pitch", key: "fineB" },
      // Gain
      gain: { section: "gain", key: "gain" },
    };

    for (const [id, mapping] of Object.entries(paramMap)) {
      if (params[id] !== undefined) {
        store.setParam(mapping.section, mapping.key as never, params[id]);
      }
    }
  }

  /**
   * Connect to the internal analyser node (for waveform display)
   */
  function connectToAnalyser(): AnalyserNode | null {
    return analyserNode;
  }

  /**
   * Get the AudioWorkletNode (for connecting to Tone.js or other nodes)
   */
  function getAudioWorkletNode(): AudioWorkletNode | null {
    return workletNode;
  }

  /**
   * Sustain pedal handling
   */
  function setSustain(active: boolean): void {
    sustainActive = active;
    if (!active) {
      // Release all sustained notes
      for (const note of sustainedNotes) {
        activeNotes.delete(note);
        activeVoices.value = Math.max(0, activeVoices.value - 1);
      }
      sustainedNotes.clear();
    }
  }

  /**
   * Clean up all audio resources
   */
  function destroy(): void {
    stopRmsMetering();

    if (workletNode) {
      workletNode.disconnect();
      workletNode = null;
    }
    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }
    if (analyserNode) {
      analyserNode.disconnect();
      analyserNode = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    activeNotes.clear();
    sustainedNotes.clear();
    isInitialized.value = false;
    activeVoices.value = 0;
    rmsLevel.value = 0;
    cpuUsage.value = 0;
  }

  // Auto-cleanup when the composable consumer unmounts
  onUnmounted(() => {
    destroy();
  });

  return {
    // State (read-only refs)
    isInitialized: readonly(isInitialized),
    activeVoices: readonly(activeVoices),
    rmsLevel: readonly(rmsLevel),
    cpuUsage: readonly(cpuUsage),

    // Methods
    init,
    noteOn,
    noteOff,
    setParam,
    syncAllParams,
    loadPreset,
    loadRipxFile,
    connectToAnalyser,
    getAudioWorkletNode,
    setSustain,
    destroy,
  };
}
