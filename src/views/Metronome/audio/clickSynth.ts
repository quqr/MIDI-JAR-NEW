import type { ClickVoiceConfig } from "../types";

/**
 * 纯合成点击声（osc + 带通噪声瞬态 + 指数衰减包络）。
 *
 * - 每次触发创建一次性节点，靠 `onended` 自清理；另有 pending 表兜底裁剪。
 * - 走指数衰减（不能到 0）并在末端显式置 0，避免爆音与尾音残留。
 */

interface PendingVoice {
  gains: GainNode[];
  sources: AudioScheduledSourceNode[];
  /** 中间节点（滤波器 / 声像），同样要在结束时断开 */
  extras: AudioNode[];
  endsAt: number;
}

export interface ClickSynth {
  trigger(config: ClickVoiceConfig, when: number, gainScale: number): void;
  cancelPending(fromTime: number): void;
  dispose(): void;
}

const ATTACK_SEC = 0.001;

function applyEnvelope(
  param: AudioParam,
  peak: number,
  decay: number,
  when: number,
): void {
  param.setValueAtTime(0, when);
  if (peak <= 0) return;
  param.linearRampToValueAtTime(peak, when + ATTACK_SEC);
  param.exponentialRampToValueAtTime(1e-4, when + decay);
  param.setValueAtTime(0, when + decay + ATTACK_SEC);
}

export function createClickSynth(
  ctx: AudioContext,
  destination: AudioNode,
): ClickSynth {
  let noiseBuffer: AudioBuffer | null = null;
  const pending: PendingVoice[] = [];
  let disposed = false;

  function getNoiseBuffer(): AudioBuffer {
    if (!noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * 0.2);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      noiseBuffer = buffer;
    }
    return noiseBuffer;
  }

  function detach(voice: PendingVoice): void {
    for (const gain of voice.gains) gain.disconnect();
    for (const extra of voice.extras) extra.disconnect();
    for (const source of voice.sources) source.disconnect();
    const index = pending.indexOf(voice);
    if (index >= 0) pending.splice(index, 1);
  }

  function prune(now: number): void {
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].endsAt < now - 0.05) detach(pending[i]);
    }
  }

  function trigger(
    config: ClickVoiceConfig,
    when: number,
    gainScale: number,
  ): void {
    if (disposed) return;
    prune(ctx.currentTime);

    const endsAt =
      when + Math.max(config.decay, config.noiseDecay) + ATTACK_SEC + 0.02;

    // ── 振荡器 ──
    const osc = ctx.createOscillator();
    osc.type = config.wave;
    osc.frequency.setValueAtTime(config.freq, when);
    const oscEnv = ctx.createGain();
    applyEnvelope(oscEnv.gain, config.peak * gainScale, config.decay, when);
    osc.connect(oscEnv);

    const extras: AudioNode[] = [];
    let tail: AudioNode = oscEnv;
    if (config.pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(config.pan, when);
      oscEnv.connect(panner);
      tail = panner;
      extras.push(panner);
    }
    tail.connect(destination);

    // ── 噪声瞬态 ──
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(config.freq * 1.5, when);
    bandpass.Q.setValueAtTime(1.2, when);
    const noiseEnv = ctx.createGain();
    applyEnvelope(
      noiseEnv.gain,
      config.noisePeak * gainScale,
      config.noiseDecay,
      when,
    );
    noise.connect(bandpass);
    bandpass.connect(noiseEnv);
    noiseEnv.connect(destination);

    osc.start(when);
    noise.start(when);
    osc.stop(endsAt);
    noise.stop(endsAt);

    const voice: PendingVoice = {
      gains: [oscEnv, noiseEnv],
      sources: [osc, noise],
      extras: [...extras, bandpass],
      endsAt,
    };
    pending.push(voice);
    osc.onended = () => detach(voice);
  }

  function cancelPending(fromTime: number): void {
    for (const voice of pending.slice()) {
      for (const gain of voice.gains) {
        gain.gain.cancelScheduledValues(fromTime);
        gain.gain.setValueAtTime(gain.gain.value, fromTime);
        gain.gain.linearRampToValueAtTime(0, fromTime + 0.01);
      }
      for (const source of voice.sources) {
        try {
          source.stop(fromTime + 0.02);
        } catch {
          // 已经停止的源会抛错，忽略
        }
      }
    }
    pending.length = 0;
  }

  function dispose(): void {
    if (disposed) return;
    cancelPending(ctx.currentTime);
    disposed = true;
  }

  return { trigger, cancelPending, dispose };
}
