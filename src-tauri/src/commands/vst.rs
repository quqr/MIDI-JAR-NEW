//! VST3 相关命令。
//!
//! # 主线程契约（重要）
//!
//! 全部 VST 状态（[`crate::vst::VstManager`]）都是主线程 `thread_local`——因为管理器
//! 持有 `HWND` 与 `!Send` 的音频句柄，无法放进 Tauri 受管状态。详见
//! `src/vst/host.rs` 顶部 threading spike 注释。
//!
//! Tauri 的 `#[tauri::command]` **默认在工作线程池执行**，所以在工作线程上直接调
//! [`crate::vst::manager`] 只会拿到 `None`。本模块因此提供 [`on_main`]：把真正的工作
//! 闭包用 `app.run_on_main_thread` 转发到主线程，再用 `oneshot` 通道把结果同步回来。
//!
//! 调用 [`on_main`] 的内部闭包必须 `Send + 'static`（`run_on_main_thread` 的要求），
//! 因此不得捕获任何 `!Send` 值——路径、字符串这类可移动数据才是安全的载荷。

use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::vst;

/// 在主线程执行 `f` 并等待其结果。
///
/// 已经位于主线程时直接执行（避免一次无谓的事件循环往返——这对音频/窗口操作尤其重要，
/// 它们的时序敏感）。
pub(crate) fn on_main<R, F>(app: &AppHandle, f: F) -> Result<R, String>
where
    R: Send + 'static,
    F: FnOnce() -> Result<R, String> + Send + 'static,
{
    if vst::is_main_thread() {
        return f();
    }

    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        // 接收端已消失（调用方超时/取消）时丢弃结果即可
        let _ = tx.send(f());
    })
    .map_err(|e| format!("failed to reach main thread: {e}"))?;

    rx.recv()
        .map_err(|_| "main thread did not answer".to_string())?
}

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
/// 扫描是重活（每个插件一次探针进程），故放到独立线程执行，并通过
/// `vst:scan-progress` 事件上报起止。扫描本身不触碰 `HWND`/音频流，
/// 因此**不需要**主线程——只有写缓存这一步是主线程状态操作。
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

/// 移除一个自定义扫描目录，返回移除后的完整目录列表。
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
/// 失败时管理器进入 [`vst::VstStatus::Error`]，前端据此进入显式错误态；
/// 返回值把同一错误抛给调用方，便于就地提示。
#[tauri::command]
pub async fn load_vst_plugin(
    app: AppHandle,
    path: String,
    open_editor: bool,
) -> Result<(), String> {
    let handle = app.clone();
    let result: Result<(), String> = on_main(&app, move || {
        let path = PathBuf::from(path);
        let path = path
            .to_str()
            .ok_or_else(|| "plugin path is not valid UTF-8".to_string())?
            .to_string();
        vst::with_manager(|mgr| mgr.load(&path, open_editor))
            .ok_or_else(|| "vst manager unavailable".to_string())?
    });

    // 状态变化（成功或错误）都广播，前端只需订阅一处
    if let Some(status) = vst::with_manager(|mgr| mgr.status().to_payload()) {
        let _ = handle.emit("vst:status", status);
    }

    result
}

/// 卸载当前插件（停止音频、关闭编辑器）。
#[tauri::command]
pub async fn unload_vst_plugin(app: AppHandle) -> Result<(), String> {
    let handle = app.clone();
    on_main(&app, || {
        vst::with_manager(|mgr| mgr.unload())
            .ok_or_else(|| "vst manager unavailable".to_string())
    })?;

    if let Some(status) = vst::with_manager(|mgr| mgr.status().to_payload()) {
        let _ = handle.emit("vst:status", status);
    }
    Ok(())
}

/// 转发一批原始 MIDI 字节到当前插件。
///
/// 载荷是 `u8` 数组（可 `Send`），因此这条命令**不需要**主线程——但
/// [`vst::manager`] 是 `thread_local`，所以在工作线程上取不到管理器。
/// 折中：命令直接在主线程上跑（通过 [`on_main`]），投递本身是无锁 ring，
/// 单次调用耗时极短，不会阻塞 UI。
#[tauri::command]
pub async fn send_vst_midi(app: AppHandle, bytes: Vec<u8>) -> Result<(), String> {
    on_main(&app, move || {
        vst::with_manager(|mgr| mgr.send_midi(&bytes))
            .ok_or_else(|| "vst manager unavailable".to_string())?
    })
}

/// 打开插件编辑器窗口。
#[tauri::command]
pub async fn open_vst_editor(app: AppHandle) -> Result<(), String> {
    on_main(&app, || {
        vst::with_manager(|mgr| mgr.open_editor())
            .ok_or_else(|| "vst manager unavailable".to_string())?
    })
}

/// 关闭插件编辑器窗口（插件保活）。
#[tauri::command]
pub async fn close_vst_editor(app: AppHandle) -> Result<(), String> {
    on_main(&app, || {
        vst::with_manager(|mgr| mgr.close_editor())
            .ok_or_else(|| "vst manager unavailable".to_string())?
    })
}

/// 查询当前 VST 状态（状态机 + 已加载插件信息）。
#[tauri::command]
pub fn get_vst_status() -> VstSnapshot {
    match vst::manager() {
        None => VstSnapshot {
            status: serde_json::json!({ "state": "empty", "message": null }),
            plugin: None,
        },
        Some(mgr) => match mgr.lock() {
            Ok(guard) => VstSnapshot {
                status: guard.status().to_payload(),
                plugin: guard.current_info(),
            },
            Err(_) => VstSnapshot {
                status: serde_json::json!({
                    "state": "error",
                    "message": "vst manager lock poisoned",
                }),
                plugin: None,
            },
        },
    }
}

/// [`get_vst_status`] 的返回形状。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VstSnapshot {
    /// `{ state, message }`，与 `vst:status` 事件同形。
    status: serde_json::Value,
    /// 已加载插件信息；未加载为 `null`。
    plugin: Option<serde_json::Value>,
}
