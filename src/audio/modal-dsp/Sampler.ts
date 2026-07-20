// Port from RipplerX Sampler.h/cpp
// 采样器，用于 sample-based mallet
// 替换 JUCE 音频文件读取为 loadFromFloat32Array / loadEncoded

// Avoid circular import: MalletType is imported as a number here
// The actual enum values are defined in Mallet.ts
const MalletType_kSample1 = 12;

export class Sampler {
  /** 波形数据 */
  waveform: Float64Array = new Float64Array(0);
  isUserFile = false;
  wavesrate = 44100.0;
  pitchfactor = 1.0;

  /** 从 base64 编码字符串加载（double 数组的 base64） */
  loadEncoded(encoded: string): void {
    const binary = atob(encoded);
    const view = new DataView(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) {
      view.setUint8(i, binary.charCodeAt(i));
    }

    const numDoubles = Math.floor(binary.length / 8);
    this.waveform = new Float64Array(numDoubles);
    for (let i = 0; i < numDoubles; i++) {
      this.waveform[i] = view.getFloat64(i * 8, true); // little-endian
    }
    this.isUserFile = true;
  }

  /** 从 Float32Array 加载采样数据（替代 JUCE 音频文件读取） */
  loadSampleFromFloat32Array(data: Float32Array, sampleRate: number): void {
    this.wavesrate = sampleRate;
    const numSamples = Math.min(3 * Math.floor(this.wavesrate), data.length);
    this.waveform = new Float64Array(numSamples);

    let maxVal = 0.0;
    for (let i = 0; i < numSamples; i++) {
      this.waveform[i] = data[i];
      maxVal = Math.max(maxVal, Math.abs(data[i]));
    }

    // 归一化波形
    if (maxVal > 0.0) {
      const scale = 1.0 / maxVal;
      for (let i = 0; i < numSamples; i++) {
        this.waveform[i] *= scale;
      }
    }

    this.isUserFile = true;
  }

  /**
   * Load an internal built-in mallet sample.
   * In the C++ version, these are embedded as JUCE BinaryData.
   * In the web version, they are loaded from the server at runtime.
   * For now, this is a placeholder that generates a simple impulse
   * since the built-in samples need to be fetched separately.
   */
  loadInternalSample(type: number): void {
    // Built-in samples would be loaded from /samples/ directory
    // For now, generate a short synthetic click as placeholder
    const sampleRate = 44100;
    const duration = 0.05; // 50ms
    const numSamples = Math.floor(sampleRate * duration);
    this.waveform = new Float64Array(numSamples);
    this.wavesrate = sampleRate;
    this.isUserFile = false;

    // Generate a simple decaying pulse
    const freq = 1000 + (type - MalletType_kSample1) * 200;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 80);
      this.waveform[i] = env * Math.sin(2 * Math.PI * freq * t);
    }
  }

  /** 线性插值读取波形 */
  waveLerp(pos: number): number {
    const i = Math.floor(pos);
    const frac = pos - i;
    const j = i + 1;
    const wrapped = j >= this.waveform.length ? 0 : j;
    return (1.0 - frac) * this.waveform[i] + frac * this.waveform[wrapped];
  }

  /** 三次插值读取波形 (Catmull-Rom) */
  waveCubic(pos: number): number {
    const N = this.waveform.length;
    const i1 = Math.floor(pos);
    const x = pos - i1;

    const i0 = (i1 - 1 + N) % N;
    const i2 = (i1 + 1) % N;
    const i3 = (i1 + 2) % N;

    const y0 = this.waveform[i0];
    const y1 = this.waveform[i1];
    const y2 = this.waveform[i2];
    const y3 = this.waveform[i3];

    const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const b = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
    const c = -0.5 * y0 + 0.5 * y2;
    const d = y1;

    return ((a * x + b) * x + c) * x + d;
  }

  /** 设置音高偏移（半音） */
  setPitch(semis: number): void {
    this.pitchfactor = Math.pow(2.0, semis / 12.0);
  }
}
