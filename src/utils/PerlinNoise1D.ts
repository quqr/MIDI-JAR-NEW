export class PerlinNoise1D {
  private permutation: Uint8Array;

  constructor(seed?: number) {
    // 构建排列表（基于种子或随机）
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    if (seed !== undefined) {
      // 简单的 Fisher–Yates 洗牌，使用种子
      let s = seed;
      for (let i = 255; i > 0; i--) {
        s = (s * 16807 + 0) % 2147483647; // 经典 LCG
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
      }
    } else {
      // 随机洗牌
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
      }
    }

    // 双倍长度避免溢出
    this.permutation = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.permutation[i] = p[i & 255];
    }
  }

  /**
   * 采样某个点的 Perlin 噪声值
   * @param x 输入坐标
   * @returns 噪声值，范围大约在 [-1, 1]
   */
  noise(x: number): number {
    const xi = Math.floor(x) & 255;
    const xf = x - Math.floor(x);

    // 平滑函数
    const u = xf * xf * (3 - 2 * xf); // 3t^2 - 2t^3

    const a = this.permutation[xi];
    const b = this.permutation[xi + 1];

    // 线性插值 + 伪随机梯度（1D 用随机值代替梯度点积）
    const gradA = this.permutation[a] / 128 - 1; // 映射到 [-1, 1]
    const gradB = this.permutation[b] / 128 - 1;

    return this.lerp(gradA, gradB, u);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  /**
   * 生成连续噪声数组
   * @param length 数组长度
   * @param step 采样步长（频率控制），越小变化越慢
   */
  generateNoise(length: number, step = 0.1): Float32Array {
    const result = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      result[i] = this.noise(i * step);
    }
    return result;
  }
}
