import { isTauri } from "@/utils/tauri";

/**
 * 双环境文件选择器
 *
 * - Tauri 环境：使用 tauriAPI.fileSystem 对话框
 * - 浏览器环境：使用隐藏 <input type="file"> 元素
 */
export function useFilePicker() {
  /**
   * 打开文件选择对话框并读取文件内容
   * @param accept - 可接受的文件类型（浏览器环境生效），如 ".mid,.midi"
   */
  async function openFile(
    accept?: string,
  ): Promise<{ name: string; data: ArrayBuffer } | null> {
    if (isTauri()) {
      return openFileTauri();
    }
    return openFileBrowser(accept);
  }

  /**
   * 保存文件
   * @param name - 文件名
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

// ─── Tauri 实现 ───

async function openFileTauri(): Promise<{ name: string; data: ArrayBuffer } | null> {
  try {
    const api = window.tauriAPI;
    if (!api) return null;

    const filePath = await api.fileSystem.openFileDialog();
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
        ? filePath.split(/[/\\]/).pop() ?? "unknown"
        : "unknown";

    return { name: fileName, data: bytes.buffer };
  } catch {
    return null;
  }
}

async function saveFileTauri(
  _name: string,
  data: ArrayBuffer | Blob,
): Promise<void> {
  try {
    const api = window.tauriAPI;
    if (!api) return;

    const filePath = await api.fileSystem.saveFileDialog();
    if (!filePath) return;

    let base64: string;
    if (data instanceof Blob) {
      const buffer = await data.arrayBuffer();
      base64 = arrayBufferToBase64(buffer);
    } else {
      base64 = arrayBufferToBase64(data);
    }

    await api.fileSystem.writeFile(filePath as string, base64);
  } catch {
    // 静默处理
  }
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
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType ?? "application/octet-stream" });
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

// ─── 工具函数 ───

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
