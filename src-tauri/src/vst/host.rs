//! VST3 插件宿主：启动时加载插件并打开其编辑器窗口。
//!
//! 迁移自原 main.rs 的实验代码；失败时仅记录日志、不中断应用启动
//! （原实验代码直接 unwrap，插件缺失会导致整个应用无法启动）。

use std::sync::{Arc, Mutex};
use vst3_host::{simple, PluginWindow};

/// Pianoteq 插件的固定安装路径（后续如需支持多插件可参数化）。
const PIANOTEQ_VST3_PATH: &str = r"C:\Program Files\Common Files\VST3\Pianoteq 9\Pianoteq 9.vst3";

/// 加载 VST 插件并打开其编辑器窗口。
///
/// - 加载或打开失败时记录 error 日志并返回；
pub fn init_vst_plugin() {
    let plugin = match simple::load_plugin(PIANOTEQ_VST3_PATH) {
        Ok(p) => p,
        Err(e) => {
            log::error!("vst: failed to load plugin '{}': {:?}", PIANOTEQ_VST3_PATH, e);
            return;
        }
    };
    log::info!("vst: loaded plugin '{}'", plugin.info().name);

    let plugin = Arc::new(Mutex::new(plugin));
    if let Some((w, h)) = plugin.lock().unwrap().take_editor_resize_request() {
    // grow your container / EditorRect to match
    log::info!("vst: plugin requested resize to {}x{}", w, h);
}
    let mut window = PluginWindow::new(plugin);
    if let Err(e) = window.open() {
        log::error!("vst: failed to open plugin window: {:?}", e);
        return;
    }
    // 窗口需存活到进程结束，否则插件编辑器会被立即关闭
    std::mem::forget(window);

}
