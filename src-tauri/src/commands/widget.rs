//! widget 子窗口管理命令：创建/关闭/枚举窗口与状态持久化。

use crate::state::{load_json, save_json, WidgetWindowState, WIDGET_STATE_FILE};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

/// 创建 widget 子窗口的参数（聚合成单参数，避免命令参数过多）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWidgetParams {
    pub label: String,
    pub title: String,
    pub url: String,
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
    pub always_on_top: bool,
}

/// 创建（或聚焦已存在的）widget 子窗口。
#[tauri::command]
pub async fn create_widget_window(app: AppHandle, params: CreateWidgetParams) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let CreateWidgetParams {
        label,
        title,
        url,
        width,
        height,
        x,
        y,
        always_on_top,
    } = params;

    // 已存在则聚焦，不再写 is_some + unwrap
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let win = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(width, height)
        .position(x, y)
        .always_on_top(always_on_top)
        .decorations(false)
        .resizable(true)
        .min_inner_size(200.0, 150.0)
        .shadow(false)
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;

    // 窗口关闭时通知前端，便于同步 widget 列表
    let app_handle = app.clone();
    let label_clone = label.clone();
    win.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { .. } = event {
            let _ = app_handle.emit("widget:closed", &label_clone);
        }
    });

    Ok(())
}

/// 关闭指定 label 的 widget 子窗口（不存在则静默成功）。
#[tauri::command]
pub fn close_widget_window(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&label) {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 读取持久化的 widget 窗口状态列表（无文件时返回空）。
#[tauri::command]
pub fn get_widget_states(app: AppHandle) -> Vec<WidgetWindowState> {
    load_json(&app, WIDGET_STATE_FILE).unwrap_or_default()
}

/// 持久化 widget 窗口状态列表。
#[tauri::command]
pub fn save_widget_states(app: AppHandle, states: Vec<WidgetWindowState>) -> Result<(), String> {
    save_json(&app, WIDGET_STATE_FILE, &states)
}

/// 枚举当前所有 widget 子窗口的 label。
#[tauri::command]
pub fn get_all_widget_windows(app: AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .filter(|k| k.starts_with("widget-"))
        .cloned()
        .collect()
}
