//! 主窗口初始化辅助：窗口几何状态防抖落盘、开发模式端口重定向。

use crate::state::{save_json, WindowState, WINDOW_STATE_FILE};
use std::time::Duration;
use tauri::{AppHandle, WindowEvent};

/// 窗口几何状态防抖保存线程：
/// 收到信号后等待 DEBOUNCE，期间若再收到信号则重置计时，
/// 从而把高频 Resized/Moved 折叠为一次落盘。
pub(crate) fn spawn_debounced_window_state_saver(app: &AppHandle, window: &tauri::WebviewWindow) {
    use std::sync::mpsc;

    const DEBOUNCE: Duration = Duration::from_millis(300);

    let (tx, rx) = mpsc::channel::<()>();
    let app = app.clone();
    let save_window = window.clone();

    std::thread::spawn(move || {
        while rx.recv().is_ok() {
            // 吞掉防抖窗口内的所有后续信号
            while rx.recv_timeout(DEBOUNCE).is_ok() {}
            let state = WindowState::from_window(&save_window);
            let _ = save_json(&app, WINDOW_STATE_FILE, &state);
        }
    });

    // Sender 随窗口事件回调存活；窗口销毁后 channel 关闭，防抖线程自动退出
    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Resized(_) | WindowEvent::Moved(_)) {
            let _ = tx.send(());
        }
    });
}

/// 开发模式下，若 Vite 因端口被占用而自动切换到其他端口，
/// 读取 src-tauri/dev-server-port 并把主窗口重定向到真实端口。
/// 该文件由 Vite 的 write-resolved-dev-port 插件在 server listening 后写入，
/// 可能晚于本函数调用，因此用一个后台线程轮询。
#[cfg(debug_assertions)]
pub(crate) fn spawn_dev_port_redirect(window: &tauri::WebviewWindow) {
    use std::fs;

    // tauri.conf.json 中的 devUrl 端口，作为“未切换”基准。
    const CONFIGURED_PORT: u16 = 5173;
    const POLL_TIMES: u32 = 100;
    const POLL_INTERVAL: Duration = Duration::from_millis(100);

    let Ok(cwd) = std::env::current_dir() else {
        return;
    };
    let port_path = cwd.join("src-tauri").join("dev-server-port");
    let win = window.clone();
    std::thread::spawn(move || {
        for _ in 0..POLL_TIMES {
            if let Ok(s) = fs::read_to_string(&port_path)
                && let Ok(port) = s.trim().parse::<u16>()
            {
                // 仅在 Vite 实际切换到非默认端口时才重定向
                if port != CONFIGURED_PORT
                    && let Ok(url) = tauri::Url::parse(&format!("http://localhost:{port}"))
                {
                    let _ = win.navigate(url);
                }
                break;
            }
            std::thread::sleep(POLL_INTERVAL);
        }
    });
}
