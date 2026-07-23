export { default as InputNote } from "./InputNote.vue";

// Props类型定义（避免从.vue文件导出）
export interface InputNoteProps {
  active?: boolean;
  inputNote?: number | null;
  chordTonic?: number | null;
  className?: string;
}
