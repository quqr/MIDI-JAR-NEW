export { default as ChordName } from "./ChordName.vue";

// Props类型定义（避免从.vue文件导出）
export interface ChordNameProps {
  chord?: string | null;
  className?: string;
}
