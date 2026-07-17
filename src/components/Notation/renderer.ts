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

/** 渲染单个谱表的配置选项 */
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

/**
 * 创建并绘制单个谱表（含谱号、调号、小节线等）
 * @param context - VexFlow 渲染上下文
 * @param options - 谱表渲染选项
 * @returns 绘制完成的 Stave 对象
 */
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

  stave.setDefaultLedgerLineStyle({ fillStyle: options.style.staffLineColor, strokeStyle: options.style.staffLineColor });

  context.setStrokeStyle(options.style.staffLineColor);
  context.setFillStyle(options.style.staffLineColor);

  stave.setContext(context).draw();

  return stave;
}

/** 渲染音符到谱表的配置选项 */
type RenderNotesOptions = {
  notes: string[];
  clef: StaveClef;
  stave: Stave;
  context: any;
  keySignatureTonic: string;
  filterClef: boolean;
  style: NotationStyleConfig;
};


/**
 * 将音符渲染到指定谱表上（含变音记号处理、格式化和绘制）
 * @param options - 音符渲染选项
 */
function renderNotesToStave(options: RenderNotesOptions): void {
  const { notes, clef, stave, context, keySignatureTonic, filterClef, style } =
    options;

  if (!notes.length) return;

  const voice = getVoice(notes, clef, filterClef);
  if (!voice) return;

  Accidental.applyAccidentals([voice], keySignatureTonic);

  applyNoteColor(voice, style.noteColor);

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

/** 大谱表（高低音联合谱表）渲染配置 */
export type GrandStaffOptions = {
  context: any;
  layout: LayoutDimensions;
  notes: string[];
  keySignatureTonic: string;
  keySignatureText?: string;
  display: NotationDisplayConfig;
  style: NotationStyleConfig;
};

/**
 * 渲染大谱表（高低音双行谱），包括花括号连接和跨谱表格式对齐
 * @param options - 大谱表渲染配置
 */
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
      applyNoteColor(voiceTreble, style.noteColor);
      formatter.joinVoices([voiceTreble]);
    }

    if (voiceBass) {
      Accidental.applyAccidentals([voiceBass], keySignatureTonic);
      applyNoteColor(voiceBass, style.noteColor);
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

/** 单谱表渲染配置 */
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

/**
 * 渲染单行谱表（高音或低音谱号）
 * @param options - 单谱表渲染配置
 */
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
