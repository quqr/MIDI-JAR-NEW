import * as Tone from "tone";
import type { AudioPreset, PhysicalPianoConfig } from "../types";
import type { SoundEngine, SoundEngineCallbacks } from "./SoundEngine";
import type { OutputChain } from "./OutputChain";
import {
  getPhysicalPianoWorkletUrl,
  revokePhysicalPianoWorkletUrl,
} from "./physicalPianoProcessor";

/**
 * PhysicalPianoEngine — SoundEngine 的 AudioWorklet 实现
 *
 * 通过 AudioWorkletNode 与 worklet 线程通信，worklet 运行波导合成算法。
 * 使用 Blob URL 加载 worklet 代码，避免 Tauri 自定义协议 CORS 问题。
 */
export class PhysicalPianoEngine implements SoundEngine {
  private outputChain: OutputChain;
  private node: AudioWorkletNode | null = null;
  private blobUrl: string | null = null;
  private callbacks: SoundEngineCallbacks = {};
  private _initialized = false;

  constructor(outputChain: OutputChain) {
    this.outputChain = outputChain;
  }

  setCallbacks(callbacks: SoundEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  async init(): Promise<void> {
    if (this._initialized) return;

    try {
      const ctx = Tone.getContext().rawContext as AudioContext;

      // 用 Blob URL 加载 worklet
      this.blobUrl = getPhysicalPianoWorkletUrl();
      await ctx.audioWorklet.addModule(this.blobUrl);

      // 创建节点
      this.node = new AudioWorkletNode(ctx, "physical-piano-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      // 连接到输出链（用 rawInput 因为 AudioWorkletNode 是原生 AudioNode）
      this.node.connect(this.outputChain.rawInput!);

      // 下发初始配置
      this.node.port.postMessage({
        type: "config",
        config: {
          brightness: 0.6,
          resonance: 0.4,
          sustain: 0.3,
          decay: 0.5,
          hammerHardness: 0.5,
          velocitySensitivity: 0.7,
          inharmonicity: 0.2,
          strikePosition: 0.125,
          polyphony: 16,
          masterGain: 0.9,
        },
      });

      this._initialized = true;
    } catch (err) {
      console.warn(
        "PhysicalPianoEngine: failed to initialize AudioWorklet, falling back to Tone engine",
        err,
      );
      throw err;
    }
  }

  connect(output: AudioNode): void {
    if (this.node) {
      this.node.connect(output);
    }
  }

  disconnect(): void {
    if (this.node) {
      this.node.disconnect();
    }
  }

  noteOn(midi: number, velocity: number): void {
    this.node?.port.postMessage({ type: "noteOn", midi, velocity });
    this.callbacks.onNoteOn?.(midi, velocity);
  }

  noteOff(midi: number): void {
    this.node?.port.postMessage({ type: "noteOff", midi });
    this.callbacks.onNoteOff?.(midi);
  }

  setSustain(enabled: boolean): void {
    this.node?.port.postMessage({
      type: "sustain",
      value: enabled ? 1 : 0,
    });
  }

  applyPreset(preset: AudioPreset): void {
    if (preset === "physical-piano") {
      // Send default config
      this.node?.port.postMessage({
        type: "config",
        config: {
          brightness: 0.6,
          resonance: 0.4,
          sustain: 0.3,
          decay: 0.5,
          hammerHardness: 0.5,
          velocitySensitivity: 0.7,
          inharmonicity: 0.2,
          strikePosition: 0.125,
          polyphony: 16,
          masterGain: 0.9,
        },
      });
    }
  }

  setVolume(db: number): void {
    this.outputChain?.setVolume(db);
  }

  setReverbWet(wet: number): void {
    this.outputChain?.setReverbWet(wet);
  }

  setReverbDecay(decay: number): void {
    this.outputChain?.setReverbDecay(decay);
  }

  setConfig(cfg: PhysicalPianoConfig): void {
    this.node?.port.postMessage({ type: "config", config: cfg });
  }

  dispose(): void {
    if (this.node) {
      // Send panic to stop all voices
      this.node.port.postMessage({ type: "panic" });
      this.node.disconnect();
      this.node = null;
    }

    if (this.blobUrl) {
      revokePhysicalPianoWorkletUrl(this.blobUrl);
      this.blobUrl = null;
    }

    this._initialized = false;
  }
}
