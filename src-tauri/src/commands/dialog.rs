//! 文件选择/保存对话框命令。
//!
//! 对话框回调本身不在主线程，用 spawn_blocking + blocking_pick_files
//! 避免占用 async worker 线程（原 mpsc::recv 阻塞写法在 Linux 有死锁案例）。

use tauri::AppHandle;

/// 对话框文件过滤器（name 为显示名，extensions 为不带点的扩展名）
#[derive(serde::Deserialize)]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

impl DialogFilter {
    fn apply<R: tauri::Runtime>(
        &self,
        dialog: tauri_plugin_dialog::FileDialogBuilder<R>,
    ) -> tauri_plugin_dialog::FileDialogBuilder<R> {
        let exts: Vec<&str> = self.extensions.iter().map(|s| s.as_str()).collect();
        dialog.add_filter(&self.name, &exts)
    }
}

/// 过滤器缺省值：未从前端传 filters 时保持旧行为（MIDI 文件）
fn default_filters() -> Vec<DialogFilter> {
    vec![
        DialogFilter {
            name: "MIDI Files".into(),
            extensions: vec!["mid".into(), "midi".into()],
        },
        DialogFilter {
            name: "All Files".into(),
            extensions: vec!["*".into()],
        },
    ]
}

/// 打开多选文件对话框（filters 可选，缺省为 MIDI 过滤器）；用户取消返回 None。
#[tauri::command]
pub async fn open_file_dialog(
    app: AppHandle,
    filters: Option<Vec<DialogFilter>>,
) -> Result<Option<Vec<String>>, String> {
    use tauri_plugin_dialog::DialogExt;
    let mut dialog = app.dialog().file();
    for f in filters.unwrap_or_else(default_filters) {
        dialog = f.apply(dialog);
    }
    tauri::async_runtime::spawn_blocking(move || dialog.blocking_pick_files())
    .await
    .map_err(|e| format!("dialog task failed: {e}"))?
    .map(|paths| paths.iter().map(|p| p.to_string()).collect::<Vec<_>>())
    .pipe(Ok)
}

/// 打开目录选择对话框（无过滤器）；用户取消返回 None。
///
/// 与 [`open_file_dialog`] 分开：`blocking_pick_folder` 只允许单选目录，
/// 而插件扫描目录是单值语义，混用会逼前端从数组里猜第一个。
#[tauri::command]
pub async fn open_directory_dialog(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().blocking_pick_folder()
    })
    .await
    .map_err(|e| format!("dialog task failed: {e}"))?
    .map(|p| p.to_string())
    .pipe(Ok)
}

/// 打开保存文件对话框（file_name/filters 可选，缺省 untitled.mid + MIDI 过滤器）；
/// 用户取消返回 None。
#[tauri::command]
pub async fn save_file_dialog(
    app: AppHandle,
    file_name: Option<String>,
    filters: Option<Vec<DialogFilter>>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let mut dialog = app.dialog().file();
    for f in filters.unwrap_or_else(default_filters) {
        dialog = f.apply(dialog);
    }
    dialog = dialog.set_file_name(&file_name.unwrap_or_else(|| "untitled.mid".into()));
    tauri::async_runtime::spawn_blocking(move || dialog.blocking_save_file())
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
