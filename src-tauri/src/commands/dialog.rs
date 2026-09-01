//! 文件选择/保存对话框命令。
//!
//! 对话框回调本身不在主线程，用 spawn_blocking + blocking_pick_files
//! 避免占用 async worker 线程（原 mpsc::recv 阻塞写法在 Linux 有死锁案例）。

use tauri::AppHandle;

/// 打开多选文件对话框（MIDI 文件过滤器）；用户取消返回 None。
#[tauri::command]
pub async fn open_file_dialog(app: AppHandle) -> Result<Option<Vec<String>>, String> {
    use tauri_plugin_dialog::DialogExt;
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("MIDI Files", &["mid", "midi"])
            .add_filter("All Files", &["*"])
            .blocking_pick_files()
    })
    .await
    .map_err(|e| format!("dialog task failed: {e}"))?
    .map(|paths| paths.iter().map(|p| p.to_string()).collect::<Vec<_>>())
    .pipe(Ok)
}

/// 打开保存文件对话框（默认文件名 untitled.mid）；用户取消返回 None。
#[tauri::command]
pub async fn save_file_dialog(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("MIDI Files", &["mid", "midi"])
            .set_file_name("untitled.mid")
            .blocking_pick_file()
    })
    .await
    .map_err(|e| format!("dialog task failed: {e}"))?
    .map(|p| p.to_string())
    .pipe(Ok)
}

/// 小工具：让 Option 直接接进 Result，避免多余的 match。
trait Pipe<T> {
    fn pipe<F, U>(self, f: F) -> U
    where
        F: FnOnce(T) -> U;
}

impl<T> Pipe<T> for T {
    fn pipe<F, U>(self, f: F) -> U
    where
        F: FnOnce(T) -> U,
    {
        f(self)
    }
}
