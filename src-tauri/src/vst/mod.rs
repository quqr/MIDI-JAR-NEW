//! VST3 插件宿主模块。
//!
//! - [`host`]：插件实例生命周期、编辑器窗口服务、音频流与 MIDI 投递
//! - [`scan`]：VST3 插件安全扫描与扫描结果缓存

mod host;
mod scan;

pub use host::{
    install_manager, is_main_thread, manager, mark_main_thread, spawn_editor_service_loop,
    with_manager,
};
pub use scan::{
    ScanCache, add_scan_path, cached_scan, effective_scan_paths, remove_scan_path,
    restore_extra_paths, scan_plugins,
};

/// 初始化 VST 子系统。
///
/// **必须在主线程调用**：管理器与主线程 ID 都是 `thread_local`，在此登记后才能被
/// 后续命令与编辑器服务循环找到。
pub fn init(app: tauri::AppHandle) {
    mark_main_thread();
    install_manager();
    spawn_editor_service_loop(app);
}
