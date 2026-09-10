/**
 * 小节线布局度量 —— `ChartMeasureCell` 的模板结构与 `ChartSystemRow`
 * 的行宽计算**共用这一份真相源**，两边宽度永远一致。
 *
 * 组件不手写宽度数字（会漂移）：直接渲染 `barlineParts()` 返回的条段，
 * 像素宽由条段求和推导（`barlineSideWidth`）。
 */
import type { BarlineKind, ChartMeasure } from "../domain/types";

/** 小节线的一个纵向条段 */
export interface BarlinePart {
  /** 像素宽（0.5 粒度） */
  w: number;
  /** 实心线段 */
  solid: boolean;
  /** 反复圆点列（用 Bravura 的 repeatDots 字形渲染） */
  dots: boolean;
}

const THIN: BarlinePart = { w: 1, solid: true, dots: false };
const THICK: BarlinePart = { w: 2.5, solid: true, dots: false };
const DOTS: BarlinePart = { w: 3, solid: false, dots: true };
const gap = (w: number): BarlinePart => ({ w, solid: false, dots: false });

/**
 * 单侧小节线的条段序列（自左向右的物理排布）。
 *
 * 误用方向的防御：repeat-start 只在左缘成立、repeat-end 只在右缘成立，
 * 放错一侧时退化为普通单线（宽度与该侧默认一致）。
 */
export function barlineParts(
  kind: BarlineKind,
  isLeft: boolean,
): BarlinePart[] {
  switch (kind) {
    // 反复开始：[细1][缝1][粗2.5][缝1.5][点3] = 9
    case "repeat-start":
      return isLeft ? [THIN, gap(1), THICK, gap(1.5), DOTS] : [THIN];
    // 反复结束：[点3][缝1.5][粗2.5][缝1][细1] = 9（圆点朝谱面内侧）
    case "repeat-end":
      return isLeft ? [THIN] : [DOTS, gap(1.5), THICK, gap(1), THIN];
    // 终止线：右缘 [细1][缝1.5][粗2.5] = 5
    case "final":
      return isLeft ? [THIN] : [THIN, gap(1.5), THICK];
    // 双线：[细1][缝2][细1] = 4
    case "double":
      return [THIN, gap(2), THIN];
    // 单线
    default:
      return [THIN];
  }
}

/** 单侧小节线的像素宽（条段求和，不另立数字） */
export function barlineSideWidth(kind: BarlineKind, isLeft: boolean): number {
  return barlineParts(kind, isLeft).reduce((sum, p) => sum + p.w, 0);
}

/** 该小节左右小节线合计像素宽 */
export function measureBarlineWidth(measure: ChartMeasure): number {
  return (
    barlineSideWidth(measure.barlineStart, true) +
    barlineSideWidth(measure.barlineEnd, false)
  );
}
