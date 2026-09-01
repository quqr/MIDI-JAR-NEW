//! 应用/窗口基础命令：版本、平台、窗口状态、置顶与外链打开。

use crate::state::WindowState;
use tauri::AppHandle;

/// 返回应用版本号（来自 tauri.conf.json）。
#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.config().version.clone().unwrap_or_default()
}

/// 返回当前操作系统名（windows / macos / linux ...）。
#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

/// 查询当前窗口是否最大化。
#[tauri::command]
pub fn is_maximized(window: tauri::WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

/// 实时读取当前窗口几何状态（位置/尺寸/最大化标志）。
#[tauri::command]
pub fn get_window_state(window: tauri::WebviewWindow) -> WindowState {
    WindowState::from_window(&window)
}

/// 设置窗口置顶，返回置顶是否实际生效。
#[tauri::command]
pub fn set_always_on_top(window: tauri::WebviewWindow, flag: bool) -> Result<bool, String> {
    window.set_always_on_top(flag).map_err(|e| e.to_string())?;
    Ok(window.is_always_on_top().unwrap_or(false))
}

/// 用系统默认程序打开外部链接。
/// 仅允许 http/https 协议，防止任意协议（file://、自定义 scheme）注入。
#[tauri::command]
pub async fn open_external(url: String, app: AppHandle) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("access denied: only http:// and https:// URLs are allowed".into());
    }
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| e.to_string())
}
