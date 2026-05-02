<template>
  <div :id="id" ref="containerRef" class="notation-base" :class="className" />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  Voice,
  BarlineType,
} from "vexflow";

import { formatSharpsFlats } from "@/helpers";
import type { NotationProps } from "./types";
import { getTransposedNotes, getVoice } from "./utils";

const props = withDefaults(defineProps<NotationProps>(), {
  id: undefined,
  className: undefined,
  midiNotes: () => [],
  staffClef: "both",
  staffTranspose: 0,
});

const { t } = useI18n();

const containerRef = ref<HTMLElement | null>(null);
let renderer: Renderer | null = null;
let resizeObserver: ResizeObserver | null = null;

const PADDING_TOP = 10;
const STAVE_HEIGHT = 120;
const STAVE_GAP = 40;
const TEXT_HEIGHT = 30;
const BOTTOM_PADDING = 10;
const KEY_SIGNATURE_WIDTH_PER_ALTERATION = 12;
const NOTE_WIDTH = 120;
const CLEF_WIDTH = 50;
const SIDE_PADDING = 40;

const notes = computed(() =>
  getTransposedNotes(
    props.midiNotes ?? [],
    props.keySignature.notes,
    props.staffTranspose,
  ),
);

const getLayoutDimensions = (
  containerWidth: number,
  containerHeight: number,
) => {
  const isBothClefs = props.staffClef === "both";
  const staveCount = isBothClefs ? 2 : 1;

  // Calculate required dimensions
  const totalStaveHeight =
    staveCount * STAVE_HEIGHT + (isBothClefs ? STAVE_GAP : 0);
  const requiredHeight =
    PADDING_TOP + TEXT_HEIGHT + totalStaveHeight + BOTTOM_PADDING;

  // Calculate key signature width based on alterations
  const keySignatureWidth =
    KEY_SIGNATURE_WIDTH_PER_ALTERATION *
    Math.abs(props.keySignature.alteration);

  // Calculate stave width ensuring minimum space for notes
  const staveWidth = Math.max(
    NOTE_WIDTH, // Minimum width for note display
    containerWidth - CLEF_WIDTH - keySignatureWidth - SIDE_PADDING * 2,
  );

  // Calculate scale with minimum constraints to prevent tiny notation
  const scaleX =
    containerWidth /
    Math.max(
      staveWidth + CLEF_WIDTH + keySignatureWidth + SIDE_PADDING * 2,
      containerWidth * 0.8,
    );
  const scaleY =
    containerHeight / Math.max(requiredHeight, containerHeight * 0.6);
  const scale = Math.min(scaleX, scaleY, 1.5); // Max scale factor of 1.5

  // Apply scaling to dimensions
  const scaledStaveWidth = staveWidth * scale;
  const scaledStaveHeight = STAVE_HEIGHT * scale;
  const scaledGap = STAVE_GAP * scale;
  const scaledPaddingTop = PADDING_TOP * scale;
  const scaledTextHeight = TEXT_HEIGHT * scale;
  const scaledBottomPadding = BOTTOM_PADDING * scale;

  // Calculate total dimensions
  const totalHeight =
    scaledPaddingTop +
    scaledTextHeight +
    staveCount * scaledStaveHeight +
    (isBothClefs ? scaledGap : 0) +
    scaledBottomPadding;
  const totalWidth =
    scaledStaveWidth +
    CLEF_WIDTH * scale +
    keySignatureWidth * scale +
    SIDE_PADDING * 2 * scale;

  // Calculate Y positions for staves
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
    keySignatureWidth: keySignatureWidth * scale,
    clefWidth: CLEF_WIDTH * scale,
    noteStartX:
      SIDE_PADDING * scale +
      CLEF_WIDTH * scale +
      keySignatureWidth * scale +
      10 * scale,
  };
};

const renderNotation = () => {
  if (!renderer || !containerRef.value) return;

  const containerWidth = containerRef.value.clientWidth;
  const containerHeight = containerRef.value.clientHeight;

  if (containerWidth === 0 || containerHeight === 0) return;

  const layout = getLayoutDimensions(containerWidth, containerHeight);

  renderer.resize(layout.totalWidth, layout.totalHeight);

  const context = renderer.getContext();
  context.setFont("Arial", 10 * layout.scale, "");
  context.clear();

  if (props.staffClef === "both") {
    renderBothClefs(context, layout);
  } else if (props.staffClef === "bass" || props.staffClef === "treble") {
    renderSingleClef(context, layout);
  }
};

const renderBothClefs = (context: any, layout: any) => {
  const { totalWidth, staveWidth, trebleY, bassY, noteStartX } = layout;

  const staveTreble = new Stave(0, trebleY, totalWidth);
  staveTreble.addClef("treble");
  staveTreble.addKeySignature(props.keySignature.tonic);
  staveTreble.setText(
    t("notation.key", { tonic: formatSharpsFlats(props.keySignature.tonic) }),
  );
  staveTreble.setBegBarType(BarlineType.NONE);
  staveTreble.setNoteStartX(noteStartX);
  staveTreble.setContext(context).draw();

  const staveBass = new Stave(0, bassY, totalWidth);
  staveBass.addClef("bass");
  staveBass.addKeySignature(props.keySignature.tonic);
  staveBass.setBegBarType(BarlineType.NONE);
  staveBass.setNoteStartX(noteStartX);
  staveBass.setContext(context).draw();

  const connector = new StaveConnector(staveTreble, staveBass);
  connector.setType("single");
  connector.setContext(context).draw();

  if (notes.value && notes.value.length) {
    const voiceTreble = getVoice(notes.value, "treble");
    const voiceBass = getVoice(notes.value, "bass");

    const formatter = new Formatter();

    if (voiceTreble) {
      Accidental.applyAccidentals([voiceTreble], props.keySignature.tonic);
      formatter.joinVoices([voiceTreble]);
    }
    if (voiceBass) {
      Accidental.applyAccidentals([voiceBass], props.keySignature.tonic);
      formatter.joinVoices([voiceBass]);
    }

    if (voiceTreble || voiceBass) {
      const v = [voiceTreble, voiceBass].filter(Boolean) as Voice[];
      formatter.createTickContexts(v);
      formatter.preFormat(staveWidth, context, v);
    }

    if (voiceTreble) {
      voiceTreble.draw(context, staveTreble);
    }
    if (voiceBass) {
      voiceBass.draw(context, staveBass);
    }
  }
};

const renderSingleClef = (context: any, layout: any) => {
  const { totalWidth, singleY, noteStartX } = layout;

  const stave = new Stave(0, singleY, totalWidth);
  stave.addClef(props.staffClef as "bass" | "treble");
  stave.addKeySignature(props.keySignature.tonic);
  stave.setText(
    t("notation.key", { tonic: formatSharpsFlats(props.keySignature.tonic) }),
  );
  stave.setBegBarType(BarlineType.NONE);
  stave.setNoteStartX(noteStartX);
  stave.setContext(context).draw();

  if (notes.value && notes.value.length) {
    const voice = getVoice(
      notes.value,
      props.staffClef as "bass" | "treble",
      false,
    );

    const formatter = new Formatter();

    if (voice) {
      Accidental.applyAccidentals([voice], props.keySignature.tonic);
      formatter.joinVoices([voice]).formatToStave([voice], stave);

      voice.draw(context, stave);
    }
  }
};

const setupResizeObserver = () => {
  if (!containerRef.value || resizeObserver) return;

  resizeObserver = new ResizeObserver(() => {
    renderNotation();
  });

  resizeObserver.observe(containerRef.value);
};

onMounted(() => {
  if (containerRef.value) {
    renderer = new Renderer(
      containerRef.value as HTMLDivElement,
      Renderer.Backends.SVG,
    );
    setupResizeObserver();
    requestAnimationFrame(renderNotation);
  }
});

watch([notes, () => props.staffClef, () => props.keySignature], () => {
  requestAnimationFrame(renderNotation);
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (renderer) {
    try {
      renderer.getContext().clear();
    } catch (e) {}
    renderer = null;
  }
});
</script>
