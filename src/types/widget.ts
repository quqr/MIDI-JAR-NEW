export type WidgetType = "keyboard" | "notation" | "chord" | "intervals";

export interface WidgetState {
  id: string;
  type: WidgetType;
  moduleId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  opacity: number;
  alwaysOnTop: boolean;
  autoHide: boolean;
  positionLocked: boolean;
}

export interface CreateWidgetOptions {
  type: WidgetType;
  moduleId: string;
  title: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  alwaysOnTop?: boolean;
}

export const WIDGET_DEFAULT_SIZES: Record<
  WidgetType,
  { width: number; height: number; minWidth: number; minHeight: number }
> = {
  keyboard: { width: 800, height: 250, minWidth: 400, minHeight: 150 },
  notation: { width: 600, height: 400, minWidth: 300, minHeight: 200 },
  chord: { width: 400, height: 300, minWidth: 200, minHeight: 150 },
  intervals: { width: 400, height: 200, minWidth: 200, minHeight: 100 },
};

export const WIDGET_TITLES: Record<WidgetType, string> = {
  keyboard: "Keyboard",
  notation: "Notation",
  chord: "Chord",
  intervals: "Intervals",
};
