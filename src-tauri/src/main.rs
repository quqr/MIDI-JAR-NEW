//! MIDI-JAR 桌面应用二进制入口：仅负责调用库的启动函数。

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    midi_jar_lib::run()
}
