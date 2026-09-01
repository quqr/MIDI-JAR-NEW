//! 沙箱文件读写命令：限制在应用数据目录内，防路径穿越。

use crate::state::resolve_within;
use std::fs;
use tauri::{AppHandle, Manager};

/// 读取应用数据目录内的文本文件（相对路径）。
#[tauri::command]
pub fn read_file(file_path: String, app: AppHandle) -> Result<String, String> {
    let allowed_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let resolved = resolve_within(&allowed_dir, &file_path)?;
    fs::read_to_string(&resolved).map_err(|e| e.to_string())
}

/// 写入应用数据目录内的文本文件（相对路径）。
#[tauri::command]
pub fn write_file(file_path: String, content: String, app: AppHandle) -> Result<(), String> {
    let allowed_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let resolved = resolve_within(&allowed_dir, &file_path)?;
    fs::write(&resolved, content).map_err(|e| e.to_string())
}
