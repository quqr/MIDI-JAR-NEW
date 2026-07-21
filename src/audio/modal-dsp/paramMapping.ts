/**
 * 单一参数映射表：AudioWorklet flat 参数 ID ↔ Pinia store 结构化 state。
 *
 * 之前 `syncAllParams`（forward）与 `applyWorkletParams`（reverse）各维护一份
 * ~50 字段的镜像字典，新增参数需双侧同步修改，是上一次"参数失效"类 bug 的
 * 根因之一。本模块抽取为单一数据源。
 *
 * 约定：
 * - `paths` 长度为 1 → 普通字段，forward 直读、reverse 直写。
 * - `paths` 长度 > 1 → forward 取所有路径之和（例如 `a_coarse` =
 *   `resonatorA.coarse + pitch.coarseA`）；reverse 把值写入第一个 path，
 *   其余 path 重置为 0，保证 forward(a) === reverse(forward(a))。
 * - `isBool: true` → reverse 时按 `value >= 0.5` 转换为 boolean。
 */
import type { RipplerXState } from "@/views/RipplerX/stores/ripplerx";

type Section = keyof RipplerXState;
type Path = readonly [Section, string];

interface Mapping {
  id: string;
  paths: readonly Path[];
  isBool?: boolean;
}

const MAPPING: readonly Mapping[] = [
  // ── Mallet ──
  { id: "mallet_type", paths: [["mallet", "type"]] },
  { id: "mallet_pitch", paths: [["mallet", "pitch"]] },
  { id: "mallet_filter", paths: [["mallet", "filter"]] },
  { id: "mallet_mix", paths: [["mallet", "mix"]] },
  { id: "mallet_res", paths: [["mallet", "resonance"]] },
  { id: "mallet_stiff", paths: [["mallet", "stiffness"]] },
  { id: "mallet_ktrack", paths: [["mallet", "keyTracking"]] },

  // ── Resonator A ──
  { id: "a_on", paths: [["resonatorA", "on"]], isBool: true },
  { id: "a_model", paths: [["resonatorA", "model"]] },
  { id: "a_partials", paths: [["resonatorA", "partials"]] },
  { id: "a_decay", paths: [["resonatorA", "decay"]] },
  { id: "a_damp", paths: [["resonatorA", "damp"]] },
  { id: "a_tone", paths: [["resonatorA", "tone"]] },
  { id: "a_hit", paths: [["resonatorA", "hit"]] },
  { id: "a_rel", paths: [["resonatorA", "release"]] },
  { id: "a_inharm", paths: [["resonatorA", "inharmonicity"]] },
  { id: "a_ratio", paths: [["resonatorA", "ratio"]] },
  { id: "a_cut", paths: [["resonatorA", "cut"]] },
  { id: "a_radius", paths: [["resonatorA", "radius"]] },
  { id: "a_coarse", paths: [["resonatorA", "coarse"], ["pitch", "coarseA"]] },
  { id: "a_fine", paths: [["resonatorA", "fine"], ["pitch", "fineA"]] },

  // ── Resonator B ──
  { id: "b_on", paths: [["resonatorB", "on"]], isBool: true },
  { id: "b_model", paths: [["resonatorB", "model"]] },
  { id: "b_partials", paths: [["resonatorB", "partials"]] },
  { id: "b_decay", paths: [["resonatorB", "decay"]] },
  { id: "b_damp", paths: [["resonatorB", "damp"]] },
  { id: "b_tone", paths: [["resonatorB", "tone"]] },
  { id: "b_hit", paths: [["resonatorB", "hit"]] },
  { id: "b_rel", paths: [["resonatorB", "release"]] },
  { id: "b_inharm", paths: [["resonatorB", "inharmonicity"]] },
  { id: "b_ratio", paths: [["resonatorB", "ratio"]] },
  { id: "b_cut", paths: [["resonatorB", "cut"]] },
  { id: "b_radius", paths: [["resonatorB", "radius"]] },
  { id: "b_coarse", paths: [["resonatorB", "coarse"], ["pitch", "coarseB"]] },
  { id: "b_fine", paths: [["resonatorB", "fine"], ["pitch", "fineB"]] },

  // ── Noise ──
  { id: "noise_mix", paths: [["noise", "mix"]] },
  { id: "noise_res", paths: [["noise", "resonance"]] },
  { id: "noise_filter_freq", paths: [["noise", "frequency"]] },
  { id: "noise_filter_q", paths: [["noise", "q"]] },
  { id: "noise_filter_mode", paths: [["noise", "filterType"]] },
  { id: "noise_att", paths: [["noise", "attack"]] },
  { id: "noise_dec", paths: [["noise", "decay"]] },
  { id: "noise_sus", paths: [["noise", "sustain"]] },
  { id: "noise_rel", paths: [["noise", "release"]] },
  { id: "noise_att_ten", paths: [["noise", "attackTension"]] },
  { id: "noise_dec_ten", paths: [["noise", "decayTension"]] },
  { id: "noise_rel_ten", paths: [["noise", "releaseTension"]] },

  // ── Coupling ──
  { id: "couple", paths: [["coupling", "mode"]] },
  { id: "ab_mix", paths: [["coupling", "mix"]] },
  { id: "ab_split", paths: [["coupling", "split"]] },

  // ── Pitch ──
  { id: "bend_range", paths: [["pitch", "bendRange"]] },

  // ── Gain (dB，与 ParamDefs 一致；UI 也是 -24..24 dB) ──
  { id: "gain", paths: [["gain", "gain"]] },
];

/** 索引：(section, key) → 影响该 store 路径的所有 mapping。一个 store 路径可能影响多个 worklet ID（罕见，目前无此情况）。 */
const STORE_PATH_INDEX: Map<string, Mapping[]> = (() => {
  const idx = new Map<string, Mapping[]>();
  for (const m of MAPPING) {
    for (const [section, key] of m.paths) {
      const k = `${section}.${key}`;
      const arr = idx.get(k) ?? [];
      arr.push(m);
      idx.set(k, arr);
    }
  }
  return idx;
})();

/** 读取 store state 中的某个数值字段（不做类型转换）。 */
function readNumber(state: RipplerXState, section: Section, key: string): number {
  const sectionObj = state[section] as unknown as Record<string, unknown>;
  const v = sectionObj[key];
  // boolean → 0/1；number 原样；其余 fallback 0。
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v;
  return 0;
}

/** 写入 store state 中的某个字段，按 isBool 决定是否转 boolean。 */
function writeValue(state: RipplerXState, section: Section, key: string, value: number, isBool?: boolean): void {
  const sectionObj = state[section] as unknown as Record<string, unknown>;
  sectionObj[key] = isBool ? value >= 0.5 : value;
}

/**
 * Forward：把 store 结构化 state 转换为 AudioWorklet 期望的 flat 参数字典。
 * 返回纯对象（无 Vue Proxy 包装），可直接 `postMessage`。
 */
export function stateToWorkletParams(state: RipplerXState): Record<string, number> {
  const params: Record<string, number> = {};
  for (const m of MAPPING) {
    let sum = 0;
    for (const [section, key] of m.paths) {
      sum += readNumber(state, section, key);
    }
    params[m.id] = sum;
  }
  return params;
}

/**
 * Reverse：把 worklet-format flat 参数（来自 preset 或 .ripx）应用回 store 结构化 state。
 * 就地修改 state 对象。缺失的 key 不动。
 */
export function applyWorkletParamsToState(params: Record<string, number>, state: RipplerXState): void {
  for (const m of MAPPING) {
    if (!(m.id in params)) continue;
    const value = params[m.id];
    // 第一个 path 是 reverse 的写入目标；其余 path 重置为 0 以保持 forward 不变。
    const [primarySection, primaryKey] = m.paths[0];
    writeValue(state, primarySection, primaryKey, value, m.isBool);
    for (let i = 1; i < m.paths.length; i++) {
      const [sec, k] = m.paths[i];
      writeValue(state, sec, k, 0, m.isBool);
    }
  }
}

/**
 * 给定一个 store 路径 (section, key)，返回所有受其影响的 worklet 参数 ID 及当前值。
 * 用于 `updateParam` 时只发送变更参数（而非每次都 `syncAllParams`），降低滑块拖动时的消息流量。
 */
export function workletIdsAffectedBy(section: Section, key: string, state: RipplerXState): Array<{ id: string; value: number }> {
  const k = `${section}.${key}`;
  const affected = STORE_PATH_INDEX.get(k);
  if (!affected) return [];
  const out: Array<{ id: string; value: number }> = [];
  for (const m of affected) {
    let sum = 0;
    for (const [s, kk] of m.paths) {
      sum += readNumber(state, s, kk);
    }
    out.push({ id: m.id, value: sum });
  }
  return out;
}
