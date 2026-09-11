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

/// 接收原始二进制 IPC body，写入系统临时目录，返回临时文件绝对路径。
///
/// 大文件（如导出的视频，几百 MB）走 JSON base64 会序列化出巨型字符串，
/// 直接把 WebView 冻死；raw body 无需编码，量级只增 ~0%。
#[tauri::command]
pub async fn write_temp_file(request: tauri::ipc::Request<'_>) -> Result<String, String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("write_temp_file: expected raw binary body".into()),
    };
    let tmp_dir = std::env::temp_dir();
    let unique = format!(
        "midi-jar-write-{}-{}.bin",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
    );
    let dest = tmp_dir.join(unique);
    let dest2 = dest.clone();
    tauri::async_runtime::spawn_blocking(move || fs::write(dest2, bytes).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("write_temp_file task failed: {e}"))??;
    Ok(dest.to_string_lossy().into_owned())
}

/// 把文件移动到目标绝对路径（保存对话框返回的路径），成功后源文件消失。
#[tauri::command]
pub async fn move_file(from: String, to: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let from = std::path::PathBuf::from(&from);
        let to = std::path::PathBuf::from(&to);
        if let Some(parent) = to.parent() {
            // 目标父目录理论上已存在（来自保存对话框），兜底创建无妨
            let _ = fs::create_dir_all(parent);
        }
        match fs::rename(&from, &to) {
            Ok(()) => Ok(()),
            // 跨盘符 rename 会失败，退回复制+删除
            Err(_) => {
                fs::copy(&from, &to).map_err(|e| e.to_string())?;
                fs::remove_file(&from).map_err(|e| e.to_string())
            }
        }
    })
    .await
    .map_err(|e| format!("move_file task failed: {e}"))?
}
