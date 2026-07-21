import { ref, readonly, onUnmounted } from "vue";
import { createLogger } from "@/utils/logger";
import { useRipplerXStore } from "../stores/ripplerx";
import { BUILT_IN_PRESETS } from "@/audio/modal-dsp/presets";
import { parseRipx } from "@/audio/modal-dsp/RipxParser";
import {
  stateToWorkletParams,
  workletIdsAffectedBy,
} from "@/audio/modal-dsp/paramMapping";
import type { RipplerXState } from "../stores/ripplerx";

const logger = createLogger("useModalSynth");

export interface ModalSynthState {
  isInitialized: boolean;
  activeVoices: number;
  rmsLevel: number;
  cpuUsage: number;
  currentPreset: string;
}

const WORKLET_URL = "/modal-synth-processor.js";
// RMS metering 刷新间隔。UI 反馈用途，与音频线程无关，因此用 setInterval 而非 rAF，
// 避免被项目"单一主 rAF 循环"约束误判（MidiFilePlayer/Recorder 那条线才是音频同步）。
const RMS_METER_INTERVAL_MS = 50;

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

  // 当前发声的音符（MIDI → velocity），用于 note-on/note-off 跟踪
  const activeNotes = new Map<number, number>();

  // 持音踏板
  let sustainActive = false;
  const sustainedNotes = new Set<number>();

  // RMS 表头采样
  let rmsTimer: ReturnType<typeof setInterval> | null = null;
  const rmsBuffer = new Uint8Array(256);

  /**
   * 启动 RMS 表头轮询。用 setInterval（非 rAF）以明确此为 UI 反馈用途，
   * 不参与音频同步，因此不受"单一主 rAF 循环"约束限制。
   */
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
    };
    rmsTimer = setInterval(tick, RMS_METER_INTERVAL_MS);
  }

  function stopRmsMetering() {
    if (rmsTimer !== null) {
      clearInterval(rmsTimer);
      rmsTimer = null;
    }
  }

  /**
   * 初始化 AudioContext，加载 AudioWorklet 模块，创建节点并绑定消息处理。
   * 浏览器 autoplay policy 下 AudioContext 起始可能 suspended，首次 noteOn 时再 resume。
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

      // Gain 节点用于最终音量；store 的 gain 是 dB，需要转 linear 才能给 GainNode。
      gainNode = audioContext.createGain();
      gainNode.gain.value = dbToLinear(store.state.gain.gain);

      // Analyser 节点用于 VU 表头
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;

      // 信号链：Worklet → Gain → Analyser → Destination
      workletNode.connect(gainNode);
      gainNode.connect(analyserNode);
      analyserNode.connect(audioContext.destination);

      // 处理 worklet → main 线程消息
      workletNode.port.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === "initialized") {
          logger.info("AudioWorklet initialized", msg.sampleRate);
        } else if (msg.type === "status") {
          // worklet 发送的字段名是 `cpuUsage`（不是 `utilization`）
          cpuUsage.value = typeof msg.cpuUsage === "number" ? msg.cpuUsage : 0;
          if (typeof msg.activeVoices === "number") {
            activeVoices.value = msg.activeVoices;
          }
        } else if (msg.type === "triggered") {
          activeVoices.value++;
        }
      };

      // 触发 worklet 端初始化
      workletNode.port.postMessage({
        type: "init",
        sampleRate: audioContext.sampleRate,
      });

      // 推送当前 store 参数到 worklet
      syncAllParams();

      startRmsMetering();
      isInitialized.value = true;
      logger.info("Modal synth initialized");
    } catch (err) {
      logger.error("Failed to initialize modal synth: %s", err);
      throw err;
    }
  }

  /** dB → linear gain，用于 GainNode.gain.value 赋值。 */
  function dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  /** 触发 note-on。velocity 为 0-127 MIDI 标准范围。 */
  function noteOn(note: number, velocity: number): void {
    if (!workletNode || !isInitialized.value) return;

    if (audioContext?.state === "suspended") {
      audioContext.resume();
    }

    activeNotes.set(note, velocity);

    workletNode.port.postMessage({
      type: "noteOn",
      note,
      velocity,
    });

    // GainNode 实时跟随 store 中的 gain（dB）
    if (gainNode) {
      gainNode.gain.setValueAtTime(
        dbToLinear(store.state.gain.gain),
        audioContext?.currentTime ?? 0,
      );
    }
  }

  /**
   * 触发 note-off。当前 prototype worklet 让 resonator 自然衰减，
   * 此处主要做 voice tracking；如持音踏板按下则缓存到 release。
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
   * 单参数实时同步：根据 store 路径 (section, key) 查表得到受影响的 worklet 参数 ID，
   * 直接发送 `setParam`（singular）消息。比 `syncAllParams` 轻——无 JSON 序列化、
   * 只发一个参数。被 `updateParam` 在滑块拖动时调用。
   */
  function syncParam(section: keyof RipplerXState, key: string): void {
    if (!workletNode || !isInitialized.value) return;
    const affected = workletIdsAffectedBy(section, key, store.state);
    for (const { id, value } of affected) {
      workletNode.port.postMessage({ type: "setParam", id, value });
    }
    // Gain 还要同步到 GainNode（dB → linear）
    if (section === "gain" && key === "gain" && gainNode) {
      gainNode.gain.setValueAtTime(
        dbToLinear(store.state.gain.gain),
        audioContext?.currentTime ?? 0,
      );
    }
  }

  /**
   * 全量参数同步：把 store 所有参数一次性推送到 worklet。
   * 用于 init 完成后、loadPreset 后、reset 后等批量场景。
   * 滑块拖动这种单参数变更请用 `syncParam`。
   */
  function syncAllParams(): void {
    if (!workletNode) return;
    const params = stateToWorkletParams(store.state);
    // JSON round-trip 去掉 Vue Proxy 包装，避免 postMessage DataCloneError
    workletNode.port.postMessage({
      type: "setParams",
      params: JSON.parse(JSON.stringify(params)),
    });

    if (gainNode) {
      gainNode.gain.setValueAtTime(
        dbToLinear(store.state.gain.gain),
        audioContext?.currentTime ?? 0,
      );
    }
  }

  /**
   * 加载内置预置。同时把预置数据写入 store（更新 UI 滑块）和 worklet（立即生效）。
   */
  function loadPreset(name: string): void {
    const preset = BUILT_IN_PRESETS[name];
    if (!preset) {
      logger.warn("Unknown preset: %s", name);
      return;
    }

    store.loadPreset(name);
    store.applyWorkletParams(preset);

    if (workletNode && isInitialized.value) {
      workletNode.port.postMessage({
        type: "loadPreset",
        preset: JSON.parse(JSON.stringify(preset)),
      });
    }

    if (gainNode) {
      gainNode.gain.setValueAtTime(
        dbToLinear(store.state.gain.gain),
        audioContext?.currentTime ?? 0,
      );
    }
  }

  /**
   * 解析并加载 .ripx 预置文件。
   * 委托给 `parseRipx`（RipxParser.ts），不再内联 magic-number + DOMParser 逻辑。
   * 格式：4 字节 magic (0x21324356 LE) + 4 字节 XML 长度 (LE) + UTF-8 XML + null。
   */
  async function loadRipxFile(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    const params = parseRipx(buffer);

    logger.info(
      "Loaded .ripx preset: %s with %d params",
      file.name,
      Object.keys(params).length,
    );

    store.applyWorkletParams(params);

    if (workletNode && isInitialized.value) {
      workletNode.port.postMessage({
        type: "loadPreset",
        preset: JSON.parse(JSON.stringify(params)),
      });
    }

    if (gainNode) {
      gainNode.gain.setValueAtTime(
        dbToLinear(store.state.gain.gain),
        audioContext?.currentTime ?? 0,
      );
    }
  }

  /** 暴露内部 AnalyserNode（用于波形显示等）。当前未被消费，预留给 WaterfallPiano 互连。 */
  function connectToAnalyser(): AnalyserNode | null {
    return analyserNode;
  }

  /**
   * 暴露内部 AudioWorkletNode，用于与 Tone.js / WaterfallPiano 互连（spec 003-audio-routing.md
   * 要求的"模态合成引擎作为瀑布钢琴替代音源"）。当前未被消费，预留接口。
   */
  function getAudioWorkletNode(): AudioWorkletNode | null {
    return workletNode;
  }

  /** 持音踏板。激活时 note-off 缓存到 sustainedNotes；释放时统一 off。 */
  function setSustain(active: boolean): void {
    sustainActive = active;
    if (!active) {
      for (const note of sustainedNotes) {
        activeNotes.delete(note);
        activeVoices.value = Math.max(0, activeVoices.value - 1);
      }
      sustainedNotes.clear();
    }
  }

  /** 释放所有音频资源。组件 unmount 时自动调用。 */
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
    syncParam,
    syncAllParams,
    loadPreset,
    loadRipxFile,
    connectToAnalyser,
    getAudioWorkletNode,
    setSustain,
    destroy,
  };
}
