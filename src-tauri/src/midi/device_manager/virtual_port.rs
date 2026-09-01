//! 虚拟端口：非 Windows 平台创建/删除虚拟输入输出端口；Windows 返回不支持错误。

use super::MidiDeviceManager;
use tauri::AppHandle;

// 真实实现依赖仅存在于非 Windows 平台
#[cfg(not(target_os = "windows"))]
use midir::os::unix::{VirtualInput, VirtualOutput};
#[cfg(not(target_os = "windows"))]
use midir::{MidiInput, MidiOutput};
#[cfg(not(target_os = "windows"))]
use crate::midi::input_device::MidiInputDevice;
#[cfg(not(target_os = "windows"))]
use crate::midi::output_device::MidiOutputDevice;
#[cfg(not(target_os = "windows"))]
use super::{OutputEntry, MODULE_OUTPUTS};

impl MidiDeviceManager {
    /// 当前平台是否支持虚拟端口（Windows 不支持）。
    pub fn is_virtual_port_supported() -> bool {
        #[cfg(target_os = "windows")]
        {
            false
        }
        #[cfg(not(target_os = "windows"))]
        {
            true
        }
    }

    /// 获取虚拟输入端口名列表。
    pub fn get_virtual_inputs(&self) -> Vec<String> {
        #[cfg(target_os = "windows")]
        {
            Vec::new()
        }
        #[cfg(not(target_os = "windows"))]
        {
            self.virtual_inputs.keys().cloned().collect()
        }
    }

    /// 获取虚拟输出端口名列表。
    pub fn get_virtual_outputs(&self) -> Vec<String> {
        #[cfg(target_os = "windows")]
        {
            Vec::new()
        }
        #[cfg(not(target_os = "windows"))]
        {
            self.virtual_outputs.keys().cloned().collect()
        }
    }

    /// 创建虚拟输入端口：其他应用可向其发送 MIDI，消息广播到内部模块。
    #[cfg(not(target_os = "windows"))]
    pub fn create_virtual_input(&mut self, name: &str, app_handle: &AppHandle) -> Result<(), String> {
        if self.virtual_inputs.contains_key(name) {
            return Err(format!("Virtual input '{}' already exists", name));
        }

        let midi_in = MidiInput::new("midi-jar-virtual-input")
            .map_err(|e| format!("Failed to create MidiInput: {}", e))?;

        let app_handle_clone = app_handle.clone();
        let name_clone = name.to_string();
        let dedup_clone = self.dedup.clone();

        let conn = midi_in
            .create_virtual(
                name,
                move |stamp, message, _| {
                    let timestamp = (stamp as f64) * 1000.0;

                    // 去重：窗口内相同消息只处理一次
                    {
                        let mut dedup = dedup_clone.lock().unwrap();
                        if dedup.is_duplicate(message, timestamp as u128) {
                            return;
                        }
                    }

                    // 广播到内部模块
                    for &module_name in MODULE_OUTPUTS {
                        let event_name = format!("midi:message:{}", module_name);
                        let _ = app_handle_clone.emit(
                            &event_name,
                            serde_json::json!({
                                "message": message,
                                "timestamp": timestamp,
                                "device": &name_clone
                            }),
                        );
                    }

                    let _ = app_handle_clone.emit(
                        "midi:activity",
                        serde_json::json!({
                            "latency": 0.0,
                            "device": &name_clone
                        }),
                    );
                },
                (),
            )
            .map_err(|e| format!("Failed to create virtual input: {}", e))?;

        self.virtual_inputs.insert(name.to_string(), conn);

        // 同步加入输入列表（标记为已连接）
        self.inputs
            .insert(name.to_string(), MidiInputDevice::new(name.to_string(), true));

        Ok(())
    }

    /// Windows 桩：虚拟输入不支持。
    #[cfg(target_os = "windows")]
    pub fn create_virtual_input(&mut self, _name: &str, _app_handle: &AppHandle) -> Result<(), String> {
        Err("Virtual ports are not supported on Windows".to_string())
    }

    /// 创建虚拟输出端口：其他应用可从其接收 MIDI。
    #[cfg(not(target_os = "windows"))]
    pub fn create_virtual_output(&mut self, name: &str) -> Result<(), String> {
        if self.virtual_outputs.contains_key(name) {
            return Err(format!("Virtual output '{}' already exists", name));
        }

        let midi_out = MidiOutput::new("midi-jar-virtual-output")
            .map_err(|e| format!("Failed to create MidiOutput: {}", e))?;

        let conn = midi_out
            .create_virtual(name)
            .map_err(|e| format!("Failed to create virtual output: {}", e))?;

        self.virtual_outputs.insert(name.to_string(), conn);

        // 以物理输出形态加入输出列表（可被路由选中）
        self.outputs.insert(
            name.to_string(),
            OutputEntry::Physical(MidiOutputDevice::new(name.to_string(), true)),
        );

        Ok(())
    }

    /// Windows 桩：虚拟输出不支持。
    #[cfg(target_os = "windows")]
    pub fn create_virtual_output(&mut self, _name: &str) -> Result<(), String> {
        Err("Virtual ports are not supported on Windows".to_string())
    }

    /// 删除虚拟输入端口（同步移出输入列表）。
    #[cfg(not(target_os = "windows"))]
    pub fn delete_virtual_input(&mut self, name: &str) -> Result<(), String> {
        if self.virtual_inputs.remove(name).is_some() {
            self.inputs.remove(name);
            Ok(())
        } else {
            Err(format!("Virtual input '{}' not found", name))
        }
    }

    /// Windows 桩：删除虚拟输入不支持。
    #[cfg(target_os = "windows")]
    pub fn delete_virtual_input(&mut self, _name: &str) -> Result<(), String> {
        Err("Virtual ports are not supported on Windows".to_string())
    }

    /// 删除虚拟输出端口（同步移出输出列表）。
    #[cfg(not(target_os = "windows"))]
    pub fn delete_virtual_output(&mut self, name: &str) -> Result<(), String> {
        if self.virtual_outputs.remove(name).is_some() {
            self.outputs.remove(name);
            Ok(())
        } else {
            Err(format!("Virtual output '{}' not found", name))
        }
    }

    /// Windows 桩：删除虚拟输出不支持。
    #[cfg(target_os = "windows")]
    pub fn delete_virtual_output(&mut self, _name: &str) -> Result<(), String> {
        Err("Virtual ports are not supported on Windows".to_string())
    }
}
