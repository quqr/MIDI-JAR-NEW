/**
 * @audio/pitch-mcleod 类型声明
 *
 * 该包发布了 index.d.ts，但 package.json 的 exports 字段未声明 "types" 条件，
 * TypeScript 无法解析，故在此手动声明（API 与 node_modules/@audio/pitch-mcleod/index.d.ts 一致）。
 */

declare module "@audio/pitch-mcleod" {
  /** McLeod Pitch Method (McLeod & Wyvill, 2005) 参数 */
  export interface McleodOptions {
    /** 采样率（Hz），默认 44100 */
    fs?: number;
    /** 峰值选取阈值（占全局最大值的比例），默认 0.9 */
    threshold?: number;
  }

  /** 单帧音高估计。无周期结构（静音/噪声/复音）时返回 null。 */
  export default function mcleod(
    data: Float32Array | Float64Array,
    options?: McleodOptions,
  ): { freq: number; clarity: number } | null;
}
