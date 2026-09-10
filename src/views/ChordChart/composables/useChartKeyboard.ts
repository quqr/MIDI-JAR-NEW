/**
 * 键盘导航绑定：把按键翻译成编辑器动作。
 *
 * 设计约定（对齐 iReal Pro，见 ADR 0023）：
 * - **方向键**：左右在小节内/跨小节移动；上下跨 system 同槽位。
 *   iReal 用上下键跳 system，本项目 `systems` 已经是分页结果，直接复用。
 * - **Shift + 方向键**：扩展选区。
 * - **Home / End**：跳到曲目首 / 尾。
 * - **Backspace / Delete**：删除当前和弦。
 * - **Escape**：清除选区。
 *
 * ⚠️ 输入框/可编辑区域内**一律不拦截**，否则会打断文本录入。
 * ⚠️ 本文件只做「按键 → 动作」映射，不含任何业务判断（那些在 `useChartEditor`）。
 */

import { onMounted, onUnmounted } from "vue";

import { useChartEditor } from "./useChartEditor";

export interface ChartKeyboardOptions {
  /**
   * 回车键的回调（打开和弦输入面板）。
   * 由页面注入——键盘层不该知道面板如何打开。
   */
  onEnter?: () => void;
  /** 字符键回调（直接开始输入），参数为输入的首字符 */
  onCharInput?: (char: string) => void;
  /**
   * 上下文面板回调（默认绑定 `Tab`）。
   * 用 Tab 而非右键：Tab 在谱面语境下无其他用途，且不触发浏览器菜单。
   */
  onContext?: () => void;
  /** 是否启用（未打开曲目时应禁用） */
  enabled?: () => boolean;
}

/** 判断事件目标是否为可编辑元素 */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

/** 是否是可打印的单字符键（用于「直接开始输入」） */
function isPrintableKey(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

/**
 * 绑定额盘导航。
 * 必须在组件 `setup` 内调用（内部用 onMounted/onUnmounted）。
 */
export function useChartKeyboard(options: ChartKeyboardOptions = {}): void {
  const editor = useChartEditor();

  function onKeydown(event: KeyboardEvent): void {
    if (options.enabled && !options.enabled()) return;
    if (isEditableTarget(event.target)) return;

    const { key, shiftKey, ctrlKey, metaKey } = event;
    const modifier = ctrlKey || metaKey;

    // Ctrl/Cmd 组合：撤销重做（其余组合放行给浏览器）
    if (modifier) {
      const lower = key.toLowerCase();
      if (lower === "z") {
        event.preventDefault();
        if (shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (lower === "y") {
        event.preventDefault();
        editor.redo();
        return;
      }
      return;
    }

    switch (key) {
      case "ArrowLeft":
        event.preventDefault();
        if (shiftKey) editor.extendLeft();
        else editor.moveLeft();
        return;
      case "ArrowRight":
        event.preventDefault();
        if (shiftKey) editor.extendRight();
        else editor.moveRight();
        return;
      case "ArrowUp":
        event.preventDefault();
        if (shiftKey) editor.extendUp();
        else editor.moveToAdjacentSystem(-1);
        return;
      case "ArrowDown":
        event.preventDefault();
        if (shiftKey) editor.extendDown();
        else editor.moveToAdjacentSystem(1);
        return;
      case "Home":
        event.preventDefault();
        editor.moveToStart();
        return;
      case "End":
        event.preventDefault();
        editor.moveToEnd();
        return;
      case "Backspace":
      case "Delete":
        if (editor.deleteAtCursor()) event.preventDefault();
        return;
      case "Escape":
        editor.clearSelection();
        return;
      case "Enter":
        if (options.onEnter) {
          event.preventDefault();
          options.onEnter();
        }
        return;
      case "Tab":
        if (options.onContext) {
          event.preventDefault();
          options.onContext();
        }
        return;
      default:
        break;
    }

    // 直接输入：可打印字符 → 打开输入面板并带上首字符
    if (options.onCharInput && isPrintableKey(event)) {
      event.preventDefault();
      options.onCharInput(key);
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", onKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", onKeydown);
  });
}
