/**
 * SMuFL 字形码位表（Bravura 字体，SIL OFL 1.1 许可）。
 *
 * ⚠️ 表中每个码位都经过**双重验证**，不要凭记忆新增：
 * 1. VexFlow 自带的 Bravura 字形表
 *    （`node_modules/vexflow/build/cjs/vexflow-bravura.js`，OSMD 同源）；
 * 2. Bravura.otf 的 cmap 用 fonttools 提取，确认字形真实存在。
 *
 * 容易踩的坑（已实证）：
 * - SMuFL「个体音符」段顺序不直观：U+E1D0 是**倍全音符**（double whole），
 *   全音符是 E1D2；八分音符在 VexFlow 里叫 `note8thUp`（不叫 Eighth）= E1D7。
 * - segno / coda 在 Repeats 段（E047 / E048），而 dalSegno / daCapo（E045/E046）
 *   是「D.S. / D.C. 文本缩写字形」，别混用。
 * - 字体文件在 `src/assets/fonts/Bravura.woff2`（323 KB，wOF2 魔数已验证），
 *   `@font-face` 与 `.music-glyph` 定义在 `src/styles/tailwind.css`。
 */
export const SMUFL_GLYPHS = {
  /** 全音符 𝅝 */
  noteWhole: "\u{E1D2}",
  /** 二分音符（符干向上） */
  noteHalf: "\u{E1D3}",
  /** 四分音符（符干向上） */
  noteQuarter: "\u{E1D5}",
  /** 八分音符（符干向上） */
  noteEighth: "\u{E1D7}",
  /** 十六分音符（符干向上） */
  note16th: "\u{E1D9}",
  /** 三十二分音符（符干向上） */
  note32nd: "\u{E1DB}",
  /** Segno 记号 𝄋 */
  segno: "\u{E047}",
  /** Coda 记号 𝄌 */
  coda: "\u{E048}",
  /** 延音线（fermata，上方） 𝄐 */
  fermata: "\u{E4C0}",
  /** 反复小节线的一对圆点 */
  repeatDots: "\u{E043}",
  /** 全休止符（整小节休止；记谱上挂在四线下方） */
  restWhole: "\u{E4E3}",
  /** 二分休止符（2–3 拍空档；记谱上坐在四线上方） */
  restHalf: "\u{E4E4}",
  /** 四分休止符（1 拍空档） */
  restQuarter: "\u{E4E5}",
  /** 降号 */
  flat: "\u{E260}",
  /** 还原号 */
  natural: "\u{E261}",
  /** 升号 */
  sharp: "\u{E262}",
} as const;

export type MusicGlyphName = keyof typeof SMUFL_GLYPHS;
