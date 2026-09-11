//! MIDI-JAR 桌面应用二进制入口。
//!
//! 两种模式（ADR 0022 进程隔离）：
//! - 默认：Tauri 桌面应用；
//! - `--vst-host`：VST 宿主子进程（主进程自复用启动，无需第二个二进制）。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|arg| arg == "--vst-host") {
        midi_jar_lib::run_vst_host();
        return;
    }
    midi_jar_lib::run()
}
