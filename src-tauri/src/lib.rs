//! MIDI-JAR Tauri 应用入口：模块组织、插件注册、命令挂载与主窗口装配。
//!
//! 模块划分：
//! - [`state`]：全局状态与持久化辅助
//! - [`commands`]：全部 `#[tauri::command]`（按领域分组）
//! - [`midi`]：MIDI 设备/路由核心（门面 [`midi::MidiManager`]）
//! - [`vst`]：VST3 插件宿主
//! - [`window_setup`]：主窗口初始化辅助
//! - [`tauri_log_sink`]：日志输出到控制台与前端

mod commands;
mod midi;
mod state;
mod tauri_log_sink;
mod vst;
mod window_setup;

use midi::MidiManager;
use state::{load_json, save_json, with_midi_write, AppState, WindowState, WINDOW_STATE_FILE};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};

/// Tauri 应用主入口。
pub fn run() {
    // 初始化 Tauri 自定义 logger（替代 env_logger）：
    // 同时输出到控制台和前端 Debugger 页面
    tauri_log_sink::init_logger();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        // 可选：主窗口几何状态交给官方插件自动持久化/恢复，
        // 可替代手写 WindowState 落盘逻辑（含 is_maximized）：
        // .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // 设置 AppHandle 到 logger，使其能够发送日志到前端
            tauri_log_sink::set_app_handle(std::sync::Arc::new(app_handle.clone()));

            // 全局状态：MIDI 管理器（读多写少，内部为 RwLock）
            let midi_manager = MidiManager::new(app_handle.clone());
            app.manage(AppState::new(midi_manager));

            // VST 插件宿主：加载 Pianoteq 并打开编辑器窗口
            // （失败仅记日志，不中断应用启动）
            vst::init_vst_plugin();

            let window = app
                .get_webview_window("main")
                .ok_or("no main window")?;

            // 所有平台统一使用无边框窗口，由前端自定义导航栏
            let _ = window.set_decorations(false);

            // 开发模式下，若 Vite 端口被占用自动切换，重定向主窗口（见函数注释）
            #[cfg(debug_assertions)]
            window_setup::spawn_dev_port_redirect(&window);

            // 窗口几何状态防抖落盘：拖拽/缩放期间事件极高频，
            // 由后台线程折叠为一次写盘（见函数注释）
            window_setup::spawn_debounced_window_state_saver(&app_handle, &window);

            // 仅在最大化状态真正翻转时通知前端（原先每次 Resized 都会 emit）
            let last_maximized = AtomicBool::new(window.is_maximized().unwrap_or(false));
            let emit_handle = app_handle.clone();
            let max_window = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::Resized(_) = event {
                    let now = max_window.is_maximized().unwrap_or(false);
                    if last_maximized.swap(now, Ordering::Relaxed) != now {
                        let _ = emit_handle.emit("window:on-maximized-changed", now);
                    }
                }
            });

            // 恢复最大化（正常路径下状态已在防抖保存线程中持久化）
            if load_json::<WindowState>(&app_handle, WINDOW_STATE_FILE)
                .map(|s| s.is_maximized)
                .unwrap_or(false)
            {
                let _ = window.maximize();
            }

            let _ = app_handle.emit("app:on-ready", ());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_version,
            commands::get_platform,
            commands::is_maximized,
            commands::get_window_state,
            commands::set_always_on_top,
            commands::open_file_dialog,
            commands::save_file_dialog,
            commands::read_file,
            commands::write_file,
            commands::open_external,
            commands::create_widget_window,
            commands::close_widget_window,
            commands::get_widget_states,
            commands::save_widget_states,
            commands::get_all_widget_windows,
            commands::refresh_devices,
            commands::clear_routes,
            commands::add_route,
            commands::delete_route,
            commands::sync_routes,
            commands::get_inputs,
            commands::get_outputs,
            commands::get_wires,
            commands::is_virtual_port_supported,
            commands::create_virtual_input,
            commands::create_virtual_output,
            commands::delete_virtual_input,
            commands::delete_virtual_output,
            commands::get_virtual_inputs,
            commands::get_virtual_outputs,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                // 兜底：确保退出前最后一刻的窗口状态也已落盘
                if let Some(window) = app_handle.get_webview_window("main") {
                    let state = WindowState::from_window(&window);
                    let _ = save_json(app_handle, WINDOW_STATE_FILE, &state);
                }
                // 停止 MIDI 刷新线程，避免退出时悬挂
                let _ = with_midi_write(app_handle, |m| m.stop_refresh_loop());
                let _ = app_handle.emit("app:on-before-quit", ());
            }
        });
}
