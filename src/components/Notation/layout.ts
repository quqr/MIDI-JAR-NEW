import type {
  StaffClef,
  NotationLayoutConfig,
  NotationDisplayConfig,
  LayoutDimensions,
} from "./types";

export function getLayoutDimensions(
  containerWidth: number,
  containerHeight: number,
  options: {
    staffClef: StaffClef;
    alteration: number;
    layout: NotationLayoutConfig;
    display: NotationDisplayConfig;
  },
): LayoutDimensions {
  const { staffClef, alteration, layout, display } = options;
  const isBothClefs = staffClef === "both";
  const staveCount = isBothClefs ? 2 : 1;

  const effectiveClefWidth = display.clef ? layout.clefWidth : 0;
  const effectiveKeySigWidth = display.keySignature
    ? layout.keySignatureWidthPerAlteration * Math.abs(alteration)
    : 0;
  const effectiveTextHeight = display.keySignatureText ? layout.textHeight : 0;

  const totalStaveHeight =
    staveCount * layout.staveHeight + (isBothClefs ? layout.staveGap : 0);
  const requiredHeight =
    layout.paddingTop + effectiveTextHeight + totalStaveHeight + layout.bottomPadding;

  const staveWidth = Math.max(
    layout.noteWidth,
    containerWidth - effectiveClefWidth - effectiveKeySigWidth - layout.sidePadding * 2,
  );

  const scaleX =
    containerWidth /
    Math.max(
      staveWidth + effectiveClefWidth + effectiveKeySigWidth + layout.sidePadding * 2,
      containerWidth * 0.8,
    );
  const scaleY = containerHeight / requiredHeight;
  const scale = Math.min(scaleX, scaleY, layout.maxScale);

  const scaledStaveWidth = staveWidth * scale;
  const scaledStaveHeight = layout.staveHeight * scale;
  const scaledGap = layout.staveGap * scale;
  const scaledPaddingTop = layout.paddingTop * scale;
  const scaledTextHeight = effectiveTextHeight * scale;
  const scaledBottomPadding = layout.bottomPadding * scale;

  const totalHeight =
    scaledPaddingTop +
    scaledTextHeight +
    staveCount * scaledStaveHeight +
    (isBothClefs ? scaledGap : 0) +
    scaledBottomPadding;
  const totalWidth =
    scaledStaveWidth +
    effectiveClefWidth * scale +
    effectiveKeySigWidth * scale +
    layout.sidePadding * 2 * scale;

  let trebleY: number;
  let bassY: number;
  let singleY: number;

  if (isBothClefs) {
    trebleY = scaledPaddingTop + scaledTextHeight;
    bassY = trebleY + scaledStaveHeight + scaledGap;
    singleY = 0;
  } else {
    trebleY = 0;
    bassY = 0;
    singleY =
      scaledPaddingTop +
      scaledTextHeight +
      (totalHeight -
        scaledPaddingTop -
        scaledTextHeight -
        scaledStaveHeight -
        scaledBottomPadding) /
        2;
  }

  return {
    totalWidth,
    totalHeight,
    staveWidth: scaledStaveWidth,
    staveHeight: scaledStaveHeight,
    scale,
    trebleY,
    bassY,
    singleY,
    keySignatureWidth: effectiveKeySigWidth * scale,
    clefWidth: effectiveClefWidth * scale,
    noteStartX:
      layout.sidePadding * scale +
      effectiveClefWidth * scale +
      effectiveKeySigWidth * scale +
      10 * scale,
  };
}
