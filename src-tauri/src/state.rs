//! 应用状态与持久化辅助模块。
//!
//! 集中管理：Tauri 全局状态 [`AppState`]、窗口/组件状态结构、
//! JSON 状态的落盘与读取、沙箱路径校验，以及 MIDI 锁的统一错误处理辅助。

use crate::midi::MidiManager;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::RwLock,
};
use tauri::{AppHandle, Manager};

// ============================================================
// 常量集中管理
// 注意：原代码常量里带 "app-data/" 前缀，又与 join("app-data") 叠加，
// 实际写入 app-data/app-data/... 嵌套目录，此处已修复。
// ============================================================
pub(crate) const APP_DATA_SUBDIR: &str = "app-data";
pub(crate) const WINDOW_STATE_FILE: &str = "window-state.json";
pub(crate) const WIDGET_STATE_FILE: &str = "widget-state.json";
pub(crate) const DEFAULT_WIDTH: f64 = 1280.0;
pub(crate) const DEFAULT_HEIGHT: f64 = 720.0;

/// Tauri 全局状态。
/// 读多写少：读命令（get_inputs 等）原本也要排队等锁，改为 RwLock 后可并发读。
pub(crate) struct AppState {
    midi: RwLock<MidiManager>,
}

impl AppState {
    /// 以指定 MIDI 管理器构造全局状态（字段保持私有，统一经此构造）。
    pub(crate) fn new(midi: MidiManager) -> Self {
        Self {
            midi: RwLock::new(midi),
        }
    }
}

// ============================================================
// 窗口/组件状态结构
// ============================================================

/// 主窗口几何状态（用于退出恢复）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct WindowState {
    pub(crate) x: Option<f64>,
    pub(crate) y: Option<f64>,
    pub(crate) width: Option<f64>,
    pub(crate) height: Option<f64>,
    pub(crate) is_maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: None,
            y: None,
            width: Some(DEFAULT_WIDTH),
            height: Some(DEFAULT_HEIGHT),
            is_maximized: false,
        }
    }
}

impl WindowState {
    /// 从当前活动窗口实时读取（前端 get_window_state 命令用）。
    pub(crate) fn from_window(window: &tauri::WebviewWindow) -> Self {
        let position = window.outer_position().ok();
        let size = window.inner_size().ok();
        Self {
            x: position.map(|p| p.x as f64),
            y: position.map(|p| p.y as f64),
            width: size.map(|s| s.width as f64),
            height: size.map(|s| s.height as f64),
            is_maximized: window.is_maximized().unwrap_or(false),
        }
    }
}

/// widget 子窗口状态（位置/尺寸/透明度/置顶等）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct WidgetWindowState {
    pub(crate) id: String,
    pub(crate) widget_type: String,
    pub(crate) module_id: String,
    pub(crate) label: String,
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
    pub(crate) is_maximized: bool,
    pub(crate) opacity: f64,
    pub(crate) always_on_top: bool,
    pub(crate) auto_hide: bool,
    pub(crate) position_locked: bool,
}

// ============================================================
// 状态持久化辅助函数（消除了原先两套几乎相同的代码）
// ============================================================

/// 解析（并确保存在）应用数据目录 `<app-data>/app-data`。
pub(crate) fn state_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {e}"))?
        .join(APP_DATA_SUBDIR);
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create app data dir: {e}"))?;
    Ok(dir)
}

/// 从状态目录读取 JSON 并反序列化；任何失败（文件缺失/格式错误）返回 None。
pub(crate) fn load_json<T: DeserializeOwned>(app: &AppHandle, file_name: &str) -> Option<T> {
    let path = state_dir(app).ok()?.join(file_name);
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

/// 将值序列化为 JSON 并写入状态目录。
pub(crate) fn save_json<T: Serialize>(
    app: &AppHandle,
    file_name: &str,
    value: &T,
) -> Result<(), String> {
    let path = state_dir(app)?.join(file_name);
    let content = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

/// 将相对路径解析到沙箱目录内；拒绝绝对路径与 `..` 路径穿越。
pub(crate) fn resolve_within(app_data: &Path, target: &str) -> Result<PathBuf, String> {
    let rel = Path::new(target);
    if rel.is_absolute() {
        return Err("absolute paths are not allowed".into());
    }
    if rel
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err("path traversal is not allowed".into());
    }
    Ok(app_data.join(rel))
}

// ============================================================
// MIDI 锁辅助：统一错误处理，消除各命令里的 lock().unwrap()
// ============================================================

/// 以读锁访问 MIDI 管理器（读命令可并发）。
pub(crate) fn with_midi_read<R>(
    app: &AppHandle,
    f: impl FnOnce(&MidiManager) -> R,
) -> Result<R, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let midi = state
        .midi
        .read()
        .map_err(|_| "midi manager lock poisoned".to_string())?;
    Ok(f(&midi))
}

/// 以写锁访问 MIDI 管理器（变更类命令串行）。
pub(crate) fn with_midi_write<R>(
    app: &AppHandle,
    f: impl FnOnce(&mut MidiManager) -> R,
) -> Result<R, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let mut midi = state
        .midi
        .write()
        .map_err(|_| "midi manager lock poisoned".to_string())?;
    Ok(f(&mut midi))
}
