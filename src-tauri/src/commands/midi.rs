//! MIDI 路由/设备/虚拟端口命令：薄封装，全部转发给 [`crate::midi::MidiManager`]。

use crate::midi::{self, MidiManager, MidiRouteRaw};
use crate::state::{with_midi_read, with_midi_write};
use tauri::AppHandle;

/// 重新扫描 MIDI 设备并向前端推送最新列表（内部 force=true，总是推送）。
#[tauri::command]
pub fn refresh_devices(app: AppHandle) -> Result<(), String> {
    with_midi_write(&app, |midi| midi.refresh_devices(&app, true))
}

/// 清空全部路由并断开所有连接。
#[tauri::command]
pub fn clear_routes(app: AppHandle) -> Result<(), String> {
    with_midi_write(&app, |midi| midi.clear_routes(&app))
}

/// 新增一条路由（同 input/output/type 已存在则忽略）。
#[tauri::command]
pub fn add_route(app: AppHandle, route: MidiRouteRaw) -> Result<(), String> {
    with_midi_write(&app, |midi| midi.add_route(&app, route))
}

/// 删除一条路由。
#[tauri::command]
pub fn delete_route(app: AppHandle, route: MidiRouteRaw) -> Result<(), String> {
    with_midi_write(&app, |midi| midi.delete_route(&app, route))
}

/// 用前端传入的完整路由列表覆盖当前路由（仅保留 enabled 项）。
#[tauri::command]
pub fn sync_routes(app: AppHandle, routes: Vec<MidiRouteRaw>) -> Result<(), String> {
    with_midi_write(&app, |midi| midi.sync_routes(&app, routes))
}

/// 获取输入设备列表。
#[tauri::command]
pub fn get_inputs(app: AppHandle) -> Result<Vec<midi::ApiMidiInput>, String> {
    with_midi_read(&app, |midi| midi.get_inputs())
}

/// 获取输出设备列表（物理设备 + internal 聚合项）。
#[tauri::command]
pub fn get_outputs(app: AppHandle) -> Result<Vec<midi::ApiMidiOutput>, String> {
    with_midi_read(&app, |midi| midi.get_outputs())
}

/// 获取当前连线（wire）及其连接状态。
#[tauri::command]
pub fn get_wires(app: AppHandle) -> Result<Vec<midi::ApiMidiWire>, String> {
    with_midi_read(&app, |midi| midi.get_wires())
}

// ============================================================
// 虚拟端口命令（Windows 不支持）
// ============================================================

/// 当前平台是否支持虚拟端口。
#[tauri::command]
pub fn is_virtual_port_supported() -> bool {
    MidiManager::is_virtual_port_supported()
}

/// 创建虚拟输入端口（其他应用可向其发送 MIDI）。
#[tauri::command]
pub fn create_virtual_input(app: AppHandle, name: String) -> Result<(), String> {
    with_midi_write(&app, |midi| midi.create_virtual_input(&app, &name)).flatten()
}

/// 创建虚拟输出端口（其他应用可从其接收 MIDI）。
#[tauri::command]
pub fn create_virtual_output(app: AppHandle, name: String) -> Result<(), String> {
    with_midi_write(&app, |midi| midi.create_virtual_output(&app, &name)).flatten()
}

/// 删除虚拟输入端口。
#[tauri::command]
pub fn delete_virtual_input(app: AppHandle, name: String) -> Result<(), String> {
    with_midi_write(&app, |midi| midi.delete_virtual_input(&app, &name)).flatten()
}

/// 删除虚拟输出端口。
#[tauri::command]
pub fn delete_virtual_output(app: AppHandle, name: String) -> Result<(), String> {
    with_midi_write(&app, |midi| midi.delete_virtual_output(&app, &name)).flatten()
}

/// 获取虚拟输入端口名列表。
#[tauri::command]
pub fn get_virtual_inputs(app: AppHandle) -> Result<Vec<String>, String> {
    with_midi_read(&app, |midi| midi.get_virtual_inputs())
}

/// 获取虚拟输出端口名列表。
#[tauri::command]
pub fn get_virtual_outputs(app: AppHandle) -> Result<Vec<String>, String> {
    with_midi_read(&app, |midi| midi.get_virtual_outputs())
}
