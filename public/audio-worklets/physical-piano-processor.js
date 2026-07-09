/**
 * Physical Piano — AudioWorkletProcessor
 *
 * 数字波导混合模型钢琴合成器 (v3)
 * 基于《电子合成器原理与创作方法》第6/7/13章设计
 *
 * 核心算法：
 *   单写指针延迟线 + 分数延迟(Thiran/线性插值互斥) → 循环低通(T60映射+|H(ω0)|补偿)
 *   → allpass频散(非谐性) → DC blocker(g>1防发散) → 加性槌击激发(|sin(nπβ)|谐波加权)
 *   → 共享音板(8带通,单次) → 等功率立体声声像 → 交感共振(踏板,O(V)) → 输出
 *
 * v3 修复（相对 v2）：
 * - 延迟线索引：单写指针 + read=writeIdx-Nint，修复 v2 readIdx==writeIdx 致无回流 bug
 * - 激发注入：从"初始条件"改为加性注入(否则修好索引后无声)
 * - 分数延迟：Thiran 与线性插值互斥(修复 v2 双重分数延迟致低音偏低)
 * - 采样率：使用 AudioWorkletGlobalScope 全局 sampleRate(修复 v2 硬编码 44100)
 * - T60：正确每样本公式 g0=0.001^(1/(fs·T60))，补偿环路低通 |H(ω0)|；g>1 加 DC blocker
 * - 音板：共享单份(物理正确 + ~16× CPU 节省)，原每声部 sbStates 移除
 * - 立体声：等功率声像(按音高)，原 outL=outR 伪立体声修复
 * - 交感共振：O(V) totalSum 方案，并修复 v2 注入被下一样本覆盖丢失的隐性 bug
 * - sustainTime：接入 DAMPING 释放速率(原为死代码,滑块无效)
 */

const SAMPLE_RATE = sampleRate; // AudioWorkletGlobalScope 全局

// ─── 音板模态参数 ───
// 8 个二阶 IIR 带通，低频 Q 高(窄)、高频 Q 低(宽)
const SOUNDBOARD_MODES = [
  { f: 160,  Q: 20,  g: 1.0 },
  { f: 260,  Q: 15,  g: 0.9 },
  { f: 420,  Q: 12,  g: 0.8 },
  { f: 700,  Q: 10,  g: 0.7 },
  { f: 1100, Q: 8,   g: 0.5 },
  { f: 1600, Q: 6,   g: 0.4 },
  { f: 2400, Q: 5,   g: 0.3 },
  { f: 3500, Q: 4,   g: 0.2 },
];

function initSoundboardCoeffs(fs) {
  return SOUNDBOARD_MODES.map((m) => {
    const w = 2 * Math.PI * m.f / fs;
    const r = Math.exp(-Math.PI * m.f / (m.Q * fs));
    const b0 = m.g * (1 - r * r);
    const a1 = -2 * r * Math.cos(w);
    const a2 = r * r;
    return { b0, a1, a2, g: m.g };
  });
}

const VOICE_STATE = {
  ATTACKING: 0,
  SUSTAINING: 1,
  DAMPING: 2,
  RELEASED: 3,
};

class PhysicalPianoProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // 共享音板系数 + 状态(单一物理体)
    this.soundboardCoeffs = initSoundboardCoeffs(SAMPLE_RATE);
    this.sbStates = SOUNDBOARD_MODES.map(() => ({ y1: 0, y2: 0 }));

    // voice 池
    this.voices = new Map();

    // 全局状态
    this.sustainDown = false;
    this.masterGain = 0.9;
    this.maxPolyphony = 16;
    this.resonance = 0.4;
    this.sustainTime = 0.3;
    this.brightness = 0.6;
    this.decay = 0.5;
    this.hammerHardness = 0.5;
    this.velocitySensitivity = 0.7;
    this.inharmonicity = 0.2;
    this.strikePosition = 0.125;

    // 交感共振:上一样本所有声部 dry 输出之和
    this.prevTotalSum = 0;

    // 平滑参数 (每样本 lerp 到目标)
    this.smoothBrightness = 0.6;
    this.smoothDecay = 0.5;
    this.smoothResonance = 0.4;
    this.smoothHammerHardness = 0.5;
    this.smoothInharmonicity = 0.2;

    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  // ─── 消息处理 ───
  handleMessage(msg) {
    switch (msg.type) {
      case "noteOn":
        this.noteOn(msg.midi, msg.velocity);
        break;
      case "noteOff":
        this.noteOff(msg.midi);
        break;
      case "sustain":
        this.setSustain(msg.value === 1);
        break;
      case "config":
        this.setConfig(msg.config);
        break;
      case "panic":
        this.panic();
        break;
    }
  }

  setConfig(cfg) {
    if (cfg.brightness !== undefined) this.brightness = cfg.brightness;
    if (cfg.resonance !== undefined) this.resonance = cfg.resonance;
    if (cfg.sustain !== undefined) this.sustainTime = cfg.sustain;
    if (cfg.decay !== undefined) this.decay = cfg.decay;
    if (cfg.hammerHardness !== undefined) this.hammerHardness = cfg.hammerHardness;
    if (cfg.velocitySensitivity !== undefined) this.velocitySensitivity = cfg.velocitySensitivity;
    if (cfg.inharmonicity !== undefined) this.inharmonicity = cfg.inharmonicity;
    if (cfg.strikePosition !== undefined) this.strikePosition = cfg.strikePosition;
    if (cfg.polyphony !== undefined) this.maxPolyphony = cfg.polyphony;
    if (cfg.masterGain !== undefined) this.masterGain = cfg.masterGain;
  }

  // ─── 力度映射：多维 ───
  // 教程依据：第13章 13.2.3 — 三维速度映射
  mapVelocity(velocity) {
    const vel = velocity / 127;
    const amp = 0.3 + 0.7 * Math.pow(vel, Math.max(0.2, 1.0 / this.velocitySensitivity));
    const effHardness = this.hammerHardness * (0.3 + 0.7 * vel);
    const decayScale = 1 + 0.3 * (1 - vel);
    const extraHarmonics = vel > 0.5 ? (vel - 0.5) * 2.0 : 0;
    return { amp, effHardness, decayScale, extraHarmonics };
  }

  // ─── T60 → 循环增益（修复：每样本模型 + |H(ω0)| 补偿）───
  // 教程依据：第6章 6.1.4
  // 环路低通 H(z)=(1-a)/(1-a·z^-1)，每样本应用 g·|H(ω0)| = g0
  // 经 fs·T60 样本后 g0^(fs·T60) = 0.001 (60dB)
  t60ToGain(freq, T60, brightness) {
    const a = 0.05 + 0.55 * (1 - brightness);
    const w0 = 2 * Math.PI * freq / SAMPLE_RATE;
    const hMag = (1 - a) / Math.sqrt(1 - 2 * a * Math.cos(w0) + a * a);
    const g0 = Math.pow(0.001, 1 / (SAMPLE_RATE * Math.max(0.01, T60)));
    // g0/hMag 略 >1(因 |H(ω0)|<1)，DC blocker 兜底；上限钳 1.05 二级保险
    return Math.min(g0 / Math.max(hMag, 1e-6), 1.05);
  }

  freqFromMidi(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ─── 触发音符 ───
  noteOn(midi, velocity) {
    if (velocity <= 0) {
      this.noteOff(midi);
      return;
    }

    const vel = velocity / 127;
    const mapped = this.mapVelocity(velocity);
    const freq = this.freqFromMidi(midi);

    // 延迟线长度 (分数延迟)
    const Nfloat = SAMPLE_RATE / (2 * freq);
    const Nint = Math.max(2, Math.floor(Nfloat));
    const frac = Nfloat - Nint;

    // T60 映射 (用当前 smoothBrightness，整音不重算)
    const T60 = 0.5 + 5.5 * (1 - this.decay) * mapped.decayScale;
    const g = this.t60ToGain(freq, T60, this.smoothBrightness);

    // 缓冲区: Nint + 4 (容纳线性插值读窗 + 余量)
    const delayLen = Nint + 4;

    // 立体声等功率声像 (按音高:低音偏左、高音偏右，限 [0.2,0.8] 避免单耳空洞)
    const pan = 0.2 + 0.6 * (midi - 21) / 87;
    const gainL = Math.cos(pan * Math.PI / 2);
    const gainR = Math.sin(pan * Math.PI / 2);

    // DAMPING 释放速率(由 sustainTime 控制:值越大释放越慢)
    // 教程依据：第6章 — 阻尼时间映射；第12章 — 释放曲线
    const releaseTau = 0.05 + this.sustainTime * 1.5; // 秒
    const dampRate = 1 - Math.exp(-1 / (SAMPLE_RATE * releaseTau));

    // ─── 预生成激发信号(加性注入) ───
    // 修好延迟线索引后,初始条件式注入会在被读出前被覆盖,故改为环路加性叠加
    const excLen = Math.round(0.003 * SAMPLE_RATE); // ~3ms
    const excitation = new Float32Array(excLen);
    let hpPrev = 0;
    for (let n = 0; n < excLen; n++) {
      // 指数衰减噪声 + 高通(硬度控制)
      const noise = (Math.random() * 2 - 1) * Math.exp(-n / (excLen * 0.3));
      const hp = mapped.effHardness * (noise - hpPrev) + hpPrev * 0.5;
      excitation[n] = hp * mapped.amp * 0.5;
    }
    // 槌击位置 β 的谱效应: 按 |sin(nπβ)| 加权注入谐波
    // 教程依据：第6章 6.4.1 — A_n = sin(n·π·β)
    if (mapped.extraHarmonics > 0) {
      for (const h of [3, 5, 7, 9]) {
        const aH = Math.abs(Math.sin(h * Math.PI * this.strikePosition))
          / h * mapped.extraHarmonics * 0.03;
        const w = 2 * Math.PI * freq * h / SAMPLE_RATE;
        for (let n = 0; n < excLen; n++) {
          excitation[n] += aH * Math.sin(w * n) * Math.exp(-n / (excLen * 0.3));
        }
      }
    }

    const voice = {
      delayLine: new Float32Array(delayLen),
      writeIdx: 0, // 单写指针；readIdx 已移除
      delayLen,
      Nint,
      fracDelay: frac,
      // 环路滤波状态
      loopPrev: 0,
      allpassPrev: 0,
      // DC blocker 状态(g>1 防发散)
      dcPrev_x: 0,
      dcPrev_y: 0,
      dcR: 1 - 2 * Math.PI * 10 / SAMPLE_RATE, // fc≈10Hz
      // 增益
      targetGain: g,
      smoothGain: g,
      dampedGain: 0.001,
      dampRate,
      // 状态机
      state: VOICE_STATE.ATTACKING,
      age: 0,
      attackSamples: 0,
      midi,
      velocity: vel,
      freq,
      // 力度映射结果(留作扩展)
      amp: mapped.amp,
      effHardness: mapped.effHardness,
      decayScale: mapped.decayScale,
      extraHarmonics: mapped.extraHarmonics,
      // 立体声
      gainL,
      gainR,
      // 激发
      excitation,
      excLen,
      excPos: 0,
      // 低音区 Thiran 全通分数延迟(midi≤48 且 frac>0.01 时启用,与线性插值互斥)
      useThiran: midi <= 48 && frac > 0.01,
      thiranA: frac > 0.01 ? (1 - frac) / (1 + frac) : 0,
      thiranPrev: 0,
      _lastOut: 0,
    };

    // voice-stealing
    if (this.voices.size >= this.maxPolyphony) {
      this.stealVoice();
    }

    // 同 midi 旧 voice 先置阻尼
    if (this.voices.has(midi)) {
      const old = this.voices.get(midi);
      old.state = VOICE_STATE.DAMPING;
      old.targetGain = old.dampedGain;
    }

    this.voices.set(midi, voice);
  }

  // ─── 释放音符 ───
  noteOff(midi) {
    const voice = this.voices.get(midi);
    if (!voice) return;
    if (this.sustainDown) {
      // 踏板踩着 → 保持 SUSTAINING
      return;
    }
    voice.state = VOICE_STATE.DAMPING;
    voice.targetGain = voice.dampedGain;
  }

  // ─── 延音踏板(交感共振在 process 中处理) ───
  setSustain(enabled) {
    this.sustainDown = enabled;
    if (!enabled) {
      for (const [midi, voice] of this.voices) {
        if (voice.state === VOICE_STATE.SUSTAINING) {
          voice.state = VOICE_STATE.DAMPING;
          voice.targetGain = voice.dampedGain;
        }
      }
    }
  }

  // ─── Voice-stealing ───
  stealVoice() {
    let candidates = [];
    const byState = {};
    for (const [midi, voice] of this.voices) {
      const s = voice.state;
      if (!byState[s]) byState[s] = [];
      byState[s].push({ midi, voice });
    }

    if (byState[VOICE_STATE.RELEASED] && byState[VOICE_STATE.RELEASED].length > 0) {
      candidates = byState[VOICE_STATE.RELEASED];
    } else {
      const lowEnergy = [];
      for (const [midi, voice] of this.voices) {
        if (voice.smoothGain < 0.01) lowEnergy.push({ midi, voice });
      }
      if (lowEnergy.length > 0) {
        candidates = lowEnergy;
      } else if (byState[VOICE_STATE.DAMPING]) {
        candidates = byState[VOICE_STATE.DAMPING];
      } else if (byState[VOICE_STATE.SUSTAINING]) {
        const sorted = byState[VOICE_STATE.SUSTAINING].sort((a, b) => b.voice.age - a.voice.age);
        if (sorted.length > 4) {
          candidates = sorted.slice(0, sorted.length - 4);
        }
      } else if (byState[VOICE_STATE.ATTACKING]) {
        candidates = byState[VOICE_STATE.ATTACKING];
      }
    }

    if (candidates.length > 0) {
      const victim = candidates.reduce((a, b) => a.voice.age > b.voice.age ? a : b);
      this.removeVoice(victim.midi);
    }
  }

  removeVoice(midi) {
    // 去点击由 DAMPING 的 smoothGain<0.002 回收阈值保证,缓冲区即丢弃
    this.voices.delete(midi);
  }

  panic() {
    for (const midi of Array.from(this.voices.keys())) {
      this.removeVoice(midi);
    }
    this.voices.clear();
    // 复位共享音板状态
    for (const st of this.sbStates) {
      st.y1 = 0;
      st.y2 = 0;
    }
    this.prevTotalSum = 0;
  }

  // ─── 共享音板带通处理(单次,输入为所有声部 dry 和) ───
  // 教程依据：第6章 6.4.3 — 并联二阶滤波器组
  processSoundboard(sample) {
    let sb = 0;
    for (let m = 0; m < this.soundboardCoeffs.length; m++) {
      const coeffs = this.soundboardCoeffs[m];
      const st = this.sbStates[m];
      const y = coeffs.b0 * sample + coeffs.a1 * st.y1 + coeffs.a2 * st.y2;
      st.y2 = st.y1;
      st.y1 = y;
      sb += y;
    }
    return sb;
  }

  // ─── 音频处理 ───
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const outL = output[0];
    const outR = output[1] || output[0];
    const numSamples = outL.length;

    // 参数平滑 (每帧逐步逼近目标)
    const smoothFactor = 0.002;
    this.smoothBrightness += (this.brightness - this.smoothBrightness) * smoothFactor;
    this.smoothDecay += (this.decay - this.smoothDecay) * smoothFactor;
    this.smoothResonance += (this.resonance - this.smoothResonance) * smoothFactor;
    this.smoothHammerHardness += (this.hammerHardness - this.smoothHammerHardness) * smoothFactor;
    this.smoothInharmonicity += (this.inharmonicity - this.smoothInharmonicity) * smoothFactor;

    const b = this.smoothBrightness;
    const res = this.smoothResonance;
    const inharm = this.smoothInharmonicity;
    const masterG = this.masterGain;

    // 循环滤波系数 a (brightness 高 → a 小 → 亮)
    const a = 0.05 + 0.55 * (1 - b);
    // 频散 allpass 系数
    const cAllpass = 0.3 * inharm;

    // 交感共振参数(O(V) totalSum 方案)
    const couplingGain = this.sustainDown ? (0.005 * res) : 0;
    const doCouple = this.sustainDown && this.voices.size >= 2 && couplingGain > 0;

    // 音板混合系数(全局)
    const resMix = res * (this.sustainDown ? 1.3 : 1.0);
    const dryMix = 1 - resMix * 0.5;
    const wetMix = resMix * 0.5;

    for (let s = 0; s < numSamples; s++) {
      let drySum = 0; // mono 和,喂共享音板
      let dryL = 0;
      let dryR = 0;

      for (const [midi, voice] of this.voices) {
        voice.age++;
        const { Nint, delayLine, delayLen, fracDelay, writeIdx } = voice;

        // ---- 读 (writeIdx - Nint,滞后 Nint 样本) ----
        const r0 = (writeIdx - Nint + delayLen) % delayLen;
        let sample;
        if (voice.useThiran) {
          // Thiran 提供分数延迟:只读整数样本,不线性插值(修复 v2 双重分数延迟)
          const x = delayLine[r0];
          const aT = voice.thiranA;
          const ap = aT * x + voice.thiranPrev;
          voice.thiranPrev = x - aT * ap;
          sample = ap;
        } else {
          // 线性插值:在 r0(延迟Nint) 与 r1(延迟Nint+1) 间插值
          const r1 = (r0 - 1 + delayLen) % delayLen;
          sample = (1 - fracDelay) * delayLine[r0] + fracDelay * delayLine[r1];
        }

        // ---- 环路低通(IIR one-pole)+ T60 增益 ----
        // DAMPING 用 dampRate(由 sustainTime 控制释放速率),其余用 0.003
        const gRate = voice.state === VOICE_STATE.DAMPING ? voice.dampRate : 0.003;
        voice.smoothGain += (voice.targetGain - voice.smoothGain) * gRate;
        const lp = (1 - a) * sample + a * voice.loopPrev;
        voice.loopPrev = lp;

        // ---- 频散 allpass ----
        const disp = cAllpass * (lp - voice.allpassPrev) + lp;
        voice.allpassPrev = disp;

        // ---- DC blocker(g>1 防发散) ----
        const dc = disp - voice.dcPrev_x + voice.dcR * voice.dcPrev_y;
        voice.dcPrev_x = disp;
        voice.dcPrev_y = dc;

        // ---- 增益 ----
        const apOut = voice.smoothGain * dc;

        // ---- 写:回流 + 加性激发 + 交感耦合 ----
        let writeVal = apOut;
        if (voice.excPos < voice.excLen) {
          writeVal += voice.excitation[voice.excPos];
          voice.excPos++;
        }
        if (doCouple && voice.state !== VOICE_STATE.DAMPING && voice.state !== VOICE_STATE.RELEASED) {
          // 其他声部上一样本 dry 输出之和(O(V))
          writeVal += (this.prevTotalSum - (voice._lastOut || 0)) * couplingGain;
        }
        delayLine[writeIdx] = writeVal;
        voice.writeIdx = (writeIdx + 1) % delayLen;

        voice._lastOut = apOut;

        // ---- 状态管理 ----
        if (voice.state === VOICE_STATE.ATTACKING) {
          voice.attackSamples++;
          if (voice.attackSamples > 0.05 * SAMPLE_RATE) {
            voice.state = VOICE_STATE.SUSTAINING;
          }
        }
        if (voice.state === VOICE_STATE.DAMPING) {
          if (voice.smoothGain < 0.002) {
            this.removeVoice(midi);
            continue;
          }
        }
        if (voice.state === VOICE_STATE.RELEASED) {
          if (voice.smoothGain < 0.001) {
            this.removeVoice(midi);
            continue;
          }
        }

        // ---- 累加 dry(立体声 + mono 和) ----
        drySum += apOut;
        dryL += apOut * voice.gainL;
        dryR += apOut * voice.gainR;
      }

      // ---- 共享音板(单次,输入 mono dry 和) ----
      const wet = this.processSoundboard(drySum);

      // ---- 输出(dry 带立体声展开,wet 居中) ----
      const l = (dryL * dryMix + wet * wetMix) * masterG;
      const r = (dryR * dryMix + wet * wetMix) * masterG;
      outL[s] = Math.max(-1, Math.min(1, l));
      outR[s] = Math.max(-1, Math.min(1, r));

      // ---- 交感共振:更新 prevTotalSum 供下一样本 ----
      this.prevTotalSum = drySum;
    }

    return true;
  }
}

registerProcessor("physical-piano-processor", PhysicalPianoProcessor);
