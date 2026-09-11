//! VST3 相关命令。
//!
//! # 进程隔离（ADR 0022）
//!
//! 插件加载 / 音频流 / 编辑器全部运行在 `vst-host` 子进程里；本模块的命令只是
//! [`crate::vst::bridge`] 的薄封装：转发请求、等待响应、广播状态事件。命令不再
//! 依赖主线程——主进程不持有任何 `!Send` 的插件资源。
//!
//! 前端契约（命令名、参数、`vst:status` 事件形状）与 in-process 时代完全一致。

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::vst;

/// 扫描进度事件载荷。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanProgress {
    /// 当前阶段：`started` / `done`。
    phase: &'static str,
    /// 已完成的插件数（`done` 阶段等于总数）。
    count: usize,
}

/// 扫描全部 VST3 插件并刷新缓存。
///
/// 目录枚举在主进程（纯文件系统），DLL 内省在 vst-host 子进程（坏插件崩溃只带走
/// 子进程）。内省是重活，放到独立线程执行，并通过 `vst:scan-progress` 事件上报起止。
#[tauri::command]
pub async fn scan_vst_plugins(app: AppHandle) -> Result<vst::ScanCache, String> {
    let handle = app.clone();
    let _ = handle.emit(
        "vst:scan-progress",
        ScanProgress {
            phase: "started",
            count: 0,
        },
    );

    let cache = tauri::async_runtime::spawn_blocking(vst::scan_plugins)
        .await
        .map_err(|e| format!("scan task failed: {e}"))?;

    let _ = handle.emit(
        "vst:scan-progress",
        ScanProgress {
            phase: "done",
            count: cache.plugins.len(),
        },
    );

    Ok(cache)
}

/// 读取缓存的扫描结果（未扫描过返回 `None`）。
#[tauri::command]
pub fn get_vst_scan_cache() -> Option<vst::ScanCache> {
    vst::cached_scan()
}

/// 添加一个自定义扫描目录，返回添加后的完整目录列表。
#[tauri::command]
pub fn add_vst_scan_path(path: String) -> Vec<String> {
    vst::add_scan_path(path)
}

/// 移除一个自定义扫描目录，返回添加后的完整目录列表。
#[tauri::command]
pub fn remove_vst_scan_path(path: String) -> Vec<String> {
    vst::remove_scan_path(&path)
}

/// 用持久化的自定义目录初始化 VST 子系统（启动时由前端调用一次）。
#[tauri::command]
pub fn restore_vst_scan_paths(paths: Vec<String>) -> Vec<String> {
    vst::restore_extra_paths(paths);
    vst::effective_scan_paths()
        .iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

/// 加载插件（可选同时打开编辑器），并启动音频流。
///
/// 失败时子进程已把状态置为 Error 并推送 `vst:status`；返回值把同一错误抛给
/// 调用方，便于就地提示。
#[tauri::command]
pub async fn load_vst_plugin(path: String, open_editor: bool) -> Result<(), String> {
    vst::load(path, open_editor)
}

/// 卸载当前插件（停止音频、关闭编辑器）。
#[tauri::command]
pub async fn unload_vst_plugin() -> Result<(), String> {
    vst::unload()
}

/// 转发一批原始 MIDI 字节到当前插件（fire-and-forget：入队即返回）。
///
/// **必须保持 async**：Tauri 2 中非 async 命令跑在主线程，而本命令随每个
/// 键盘音符高频触发——同步版本曾是"点键盘整界面卡死"的直接元凶之一。
#[tauri::command]
pub async fn send_vst_midi(bytes: Vec<u8>) -> Result<(), String> {
    vst::send_midi(bytes)
}

/// 打开插件编辑器浮窗。
#[tauri::command]
pub async fn open_vst_editor() -> Result<(), String> {
    vst::open_editor()
}

/// 关闭插件编辑器窗口（插件保活）。
#[tauri::command]
pub async fn close_vst_editor() -> Result<(), String> {
    vst::close_editor()
}

/// 查询当前 VST 状态（状态机 + 已加载插件信息，来自桥的最近快照缓存）。
#[tauri::command]
pub fn get_vst_status() -> VstSnapshot {
    VstSnapshot {
        snapshot: vst::snapshot(),
    }
}

/// [`get_vst_status`] 的返回形状。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VstSnapshot {
    /// `{ status: {state,message}, plugin }`，与子进程推送的 snapshot 事件同形。
    #[serde(flatten)]
    snapshot: serde_json::Value,
}
