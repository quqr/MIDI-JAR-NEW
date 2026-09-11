//! VST3 插件宿主模块（ADR 0022：进程隔离）。
//!
//! - [`bridge`]：主进程侧子进程桥（生命周期、协议转发、事件桥接）
//! - [`child`]：vst-host 子进程（`--vst-host` 模式的入口与协议主循环）
//! - [`host`]：插件实例生命周期、编辑器窗口服务、音频流与 MIDI 投递（子进程内）
//! - [`scan`]：目录枚举（主进程）+ 逐插件内省（子进程）+ 扫描缓存（主进程）

mod bridge;
mod child;
mod host;
mod scan;

// 注意：`init` 是本模块的包装函数（见下），不能从 bridge 重导出同名项；
// `introspect` 仅被 scan 内部经 `super::bridge` 调用，无需重导出。
pub use bridge::{close_editor, load, open_editor, send_midi, shutdown, snapshot, unload};
pub use scan::{
    ScanCache, add_scan_path, cached_scan, effective_scan_paths, remove_scan_path,
    restore_extra_paths, scan_plugins,
};

/// vst-host 子进程模式入口（`--vst-host` 时由 `main` 调用，阻塞至 shutdown）。
pub fn run_host() {
    child::run();
}

/// 初始化 VST 子系统（主进程侧）。在应用 setup 阶段调用一次。
///
/// 进程隔离后主进程只剩桥：注册事件广播通道即可；子进程在首次
/// load / scan / snapshot 请求时按需拉起。
pub fn init(app: tauri::AppHandle) {
    bridge::init(app);
}
