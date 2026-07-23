export { default as ChordNameLink } from "./ChordNameLink.vue";

// Props类型定义（避免从.vue文件导出）
export interface ChordNameLinkProps {
  chord?: string | null;
  className?: string;
}
