import {
  Accidental,
  Formatter,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
  BarlineType,
  StaveModifierPosition,
} from "vexflow";

import type {
  NotationDisplayConfig,
  NotationStyleConfig,
  LayoutDimensions,
} from "./types";
import { getVoice } from "./utils";

type StaveClef = "treble" | "bass";

type RenderStaveOptions = {
  x: number;
  y: number;
  width: number;
  clef: StaveClef;
  keySignatureTonic: string;
  display: NotationDisplayConfig;
  style: NotationStyleConfig;
  noteStartX: number;
  keySignatureText?: string;
};

function createAndDrawStave(context: any, options: RenderStaveOptions): Stave {
  const stave = new Stave(options.x, options.y, options.width);

  if (options.display.clef) {
    stave.addClef(options.clef);
  }

  if (options.display.keySignature) {
    stave.addKeySignature(options.keySignatureTonic);
  }

  if (options.display.keySignatureText && options.keySignatureText) {
    stave.setStaveText(options.keySignatureText, StaveModifierPosition.ABOVE);
  }

  if (!options.display.barlines) {
    stave.setBegBarType(BarlineType.NONE);
  }

  stave.setNoteStartX(options.noteStartX);

  if (options.style.staffLineColor !== "#000000") {
    stave.setStyle({ strokeStyle: options.style.staffLineColor });
  }

  stave.setContext(context).draw();
  return stave;
}

type RenderNotesOptions = {
  notes: string[];
  clef: StaveClef;
  stave: Stave;
  context: any;
  keySignatureTonic: string;
  filterClef: boolean;
  style: NotationStyleConfig;
};

function renderNotesToStave(options: RenderNotesOptions): void {
  const { notes, clef, stave, context, keySignatureTonic, filterClef, style } =
    options;

  if (!notes.length) return;

  const voice = getVoice(notes, clef, filterClef);
  if (!voice) return;

  Accidental.applyAccidentals([voice], keySignatureTonic);

  if (style.noteColor !== "#000000") {
    applyNoteColor(voice, style.noteColor);
  }

  const formatter = new Formatter();
  formatter.joinVoices([voice]).formatToStave([voice], stave);

  voice.draw(context, stave);
}

function applyNoteColor(voice: Voice, color: string): void {
  const tickables = voice.getTickables();
  for (const tickable of tickables) {
    if (tickable instanceof StaveNote) {
      tickable.setStyle({ fillStyle: color, strokeStyle: color });
    }
  }
}

export type GrandStaffOptions = {
  context: any;
  layout: LayoutDimensions;
  notes: string[];
  keySignatureTonic: string;
  keySignatureText?: string;
  display: NotationDisplayConfig;
  style: NotationStyleConfig;
};

export function renderGrandStaff(options: GrandStaffOptions): void {
  const {
    context,
    layout,
    notes,
    keySignatureTonic,
    keySignatureText,
    display,
    style,
  } = options;

  const staveTreble = createAndDrawStave(context, {
    x: 0,
    y: layout.trebleY,
    width: layout.totalWidth,
    clef: "treble",
    keySignatureTonic,
    display,
    style,
    noteStartX: layout.noteStartX,
    keySignatureText,
  });

  const staveBass = createAndDrawStave(context, {
    x: 0,
    y: layout.bassY,
    width: layout.totalWidth,
    clef: "bass",
    keySignatureTonic,
    display,
    style,
    noteStartX: layout.noteStartX,
  });

  if (display.clef) {
    const connector = new StaveConnector(staveTreble, staveBass);
    connector.setType("single");
    connector.setContext(context).draw();
  }

  if (notes.length) {
    const voiceTreble = getVoice(notes, "treble");
    const voiceBass = getVoice(notes, "bass");

    const formatter = new Formatter();

    if (voiceTreble) {
      Accidental.applyAccidentals([voiceTreble], keySignatureTonic);
      if (style.noteColor !== "#000000") {
        applyNoteColor(voiceTreble, style.noteColor);
      }
      formatter.joinVoices([voiceTreble]);
    }

    if (voiceBass) {
      Accidental.applyAccidentals([voiceBass], keySignatureTonic);
      if (style.noteColor !== "#000000") {
        applyNoteColor(voiceBass, style.noteColor);
      }
      formatter.joinVoices([voiceBass]);
    }

    if (voiceTreble || voiceBass) {
      const v = [voiceTreble, voiceBass].filter(Boolean) as Voice[];
      formatter.createTickContexts(v);
      formatter.preFormat(layout.staveWidth, context, v);
    }

    if (voiceTreble) {
      voiceTreble.draw(context, staveTreble);
    }
    if (voiceBass) {
      voiceBass.draw(context, staveBass);
    }
  }
}

export type SingleStaffOptions = {
  context: any;
  layout: LayoutDimensions;
  notes: string[];
  staffClef: "bass" | "treble";
  keySignatureTonic: string;
  keySignatureText?: string;
  display: NotationDisplayConfig;
  style: NotationStyleConfig;
};

export function renderSingleStaff(options: SingleStaffOptions): void {
  const {
    context,
    layout,
    notes,
    staffClef,
    keySignatureTonic,
    keySignatureText,
    display,
    style,
  } = options;

  const stave = createAndDrawStave(context, {
    x: 0,
    y: layout.singleY,
    width: layout.totalWidth,
    clef: staffClef,
    keySignatureTonic,
    display,
    style,
    noteStartX: layout.noteStartX,
    keySignatureText,
  });

  if (notes.length) {
    renderNotesToStave({
      notes,
      clef: staffClef,
      stave,
      context,
      keySignatureTonic,
      filterClef: false,
      style,
    });
  }
}
