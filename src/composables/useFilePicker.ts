import { isTauri } from "@/utils/tauri";
import type { DialogFilter } from "@/types/tauri";

/**
 * 双环境文件选择器
 *
 * - Tauri 环境：使用 tauriAPI.fileSystem 对话框
 * - 浏览器环境：使用隐藏 <input type="file"> 元素
 */
export function useFilePicker() {
  /**
   * 打开文件选择对话框并读取文件内容
   * @param accept - 可接受的文件类型，如 ".mid,.midi"（双环境均生效）
   */
  async function openFile(
    accept?: string,
  ): Promise<{ name: string; data: ArrayBuffer } | null> {
    if (isTauri()) {
      return openFileTauri(acceptToFilters(accept));
    }
    return openFileBrowser(accept);
  }

  /**
   * 保存文件
   * @param name - 文件名（双环境均生效）
   * @param data - 文件数据
   * @param mimeType - MIME 类型（浏览器环境生效）
   */
  async function saveFile(
    name: string,
    data: ArrayBuffer | Blob,
    mimeType?: string,
  ): Promise<void> {
    if (isTauri()) {
      return saveFileTauri(name, data);
    }
    return saveFileBrowser(name, data, mimeType);
  }

  return { openFile, saveFile };
}

/**
 * 把浏览器风格的 accept 字符串（".mid,.midi"）解析为 Tauri 对话框过滤器
 */
function acceptToFilters(accept?: string): DialogFilter[] | undefined {
  if (!accept) return undefined;
  const extensions = accept
    .split(",")
    .map((s) => s.trim().replace(/^\./, ""))
    .filter(Boolean);
  if (extensions.length === 0) return undefined;
  return [{ name: "Files", extensions }];
}

/** 按保存文件名推断过滤器（如 video.mp4 → mp4），供 Tauri 保存对话框使用 */
function filterFromName(name: string): DialogFilter[] | undefined {
  const ext = name.split(".").pop();
  if (!ext || ext === name) return undefined;
  return [{ name: ext.toUpperCase(), extensions: [ext.toLowerCase()] }];
}

// ─── Tauri 实现 ───

async function openFileTauri(filters?: DialogFilter[]): Promise<{
  name: string;
  data: ArrayBuffer;
} | null> {
  try {
    const api = window.tauriAPI;
    if (!api) return null;

    const filePath = await api.fileSystem.openFileDialog(filters);
    if (!filePath) return null;

    const result = await api.fileSystem.readFile(filePath as string);
    if (!result.success || !result.content) return null;

    // Tauri readFile 返回 base64 编码的字符串，解码为 ArrayBuffer
    const binary = atob(result.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const fileName =
      typeof filePath === "string"
        ? (filePath.split(/[/\\]/).pop() ?? "unknown")
        : "unknown";

    return { name: fileName, data: bytes.buffer };
  } catch {
    return null;
  }
}

async function saveFileTauri(
  name: string,
  data: ArrayBuffer | Blob,
): Promise<void> {
  const api = window.tauriAPI;
  if (!api) return;

  const filePath = await api.fileSystem.saveFileDialog(
    name,
    filterFromName(name),
  );
  if (!filePath) return;

  // 大文件走原始字节 IPC：写临时文件再移动到目标路径，
  // 避免几百 MB base64 + JSON 序列化冻结 WebView
  const bytes =
    data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
  const tmpPath = await api.fileSystem.writeTempFile(bytes);
  // 移动失败时错误抛给调用方（临时文件留在系统临时目录，无碍）
  await api.fileSystem.moveFile(tmpPath, filePath as string);
}

// ─── 浏览器实现 ───

async function openFileBrowser(
  accept?: string,
): Promise<{ name: string; data: ArrayBuffer } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    if (accept) input.accept = accept;

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const data = await file.arrayBuffer();
        resolve({ name: file.name, data });
      } catch {
        resolve(null);
      } finally {
        input.remove();
      }
    };

    input.oncancel = () => {
      resolve(null);
      input.remove();
    };

    document.body.appendChild(input);
    input.click();
  });
}

async function saveFileBrowser(
  name: string,
  data: ArrayBuffer | Blob,
  mimeType?: string,
): Promise<void> {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data], { type: mimeType ?? "application/octet-stream" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  // 清理
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 100);
}


