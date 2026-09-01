//! MIDI 设备管理器：物理/内部输入输出设备的发现、连接状态维护与查询。
//!
//! 职责划分：路由增量编排在 [`routing`]，连接建立在 [`connection`]，
//! 消息去重见 [`dedup`]，虚拟端口见 [`virtual_port`]（Windows 平台不支持）。

mod connection;
mod dedup;
mod routing;
mod virtual_port;

use dedup::MidiDedup;
use log::warn;
use midir::{MidiInput, MidiOutput, MidiOutputConnection};
use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};

use super::input_device::{ApiMidiInput, MidiInputDevice};
use super::internal_output::InternalOutput;
use super::output_device::{ApiMidiOutput, MidiOutputDevice};
use super::wire::{ApiMidiWire, MidiWire};

/// 忽略含该子串的端口名（RtMidi 自建端口）
const IGNORE_RTMIDI_REGEX: &str = "RtMidi";
/// 忽略内部输出在输入侧的回显端口名（正则）
const IGNORE_INPUT_REGEX: &str = "^output-internal";

static IGNORE_INPUT_RE: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(IGNORE_INPUT_REGEX).unwrap());

/// 内部模块输出名列表：internal 路由的消息会广播到这些前端模块
const MODULE_OUTPUTS: &[&str; 3] = &[
    "chord-dictionary",
    "chord-display/default",
    "debugger",
];

type MidiInputConnection = midir::MidiInputConnection<()>;

/// MIDI 设备管理器：聚合输入/输出设备表、路由连线与活跃连接。
pub struct MidiDeviceManager {
    midi_in: Option<MidiInput>,
    midi_out: Option<MidiOutput>,
    inputs: HashMap<String, MidiInputDevice>,
    outputs: HashMap<String, OutputEntry>,
    wires: Vec<MidiWire>,
    active_connections: HashMap<String, MidiInputConnection>,
    active_output_connections: Arc<Mutex<HashMap<String, MidiOutputConnection>>>,
    dedup: Arc<Mutex<MidiDedup>>,
    // 虚拟端口（Windows 不支持）
    #[cfg(not(target_os = "windows"))]
    virtual_inputs: HashMap<String, MidiInputConnection>,
    #[cfg(not(target_os = "windows"))]
    virtual_outputs: HashMap<String, MidiOutputConnection>,
}

/// 输出表项：物理设备或内部模块输出
enum OutputEntry {
    Physical(MidiOutputDevice),
    Internal(InternalOutput),
}

impl MidiDeviceManager {
    /// 创建管理器并注册内部模块输出。
    pub fn new() -> Self {
        let mut manager = Self {
            midi_in: MidiInput::new("midi-jar-input").ok(),
            midi_out: MidiOutput::new("midi-jar-output").ok(),
            inputs: HashMap::new(),
            outputs: HashMap::new(),
            wires: Vec::new(),
            active_connections: HashMap::new(),
            active_output_connections: Arc::new(Mutex::new(HashMap::new())),
            dedup: Arc::new(Mutex::new(MidiDedup::new())),
            #[cfg(not(target_os = "windows"))]
            virtual_inputs: HashMap::new(),
            #[cfg(not(target_os = "windows"))]
            virtual_outputs: HashMap::new(),
        };
        manager.refresh_internal_outputs();
        manager
    }

    /// 全量刷新设备表；任一类别发生变化则返回 true。
    pub fn refresh(&mut self) -> bool {
        let mut changed = false;
        changed = self.refresh_internal_outputs() || changed;
        changed = self.refresh_inputs() || changed;
        changed = self.refresh_outputs() || changed;
        changed
    }

    /// 确保内部模块输出全部注册。
    fn refresh_internal_outputs(&mut self) -> bool {
        let mut changed = false;
        for &name in MODULE_OUTPUTS {
            if !self.outputs.contains_key(name) {
                self.outputs
                    .insert(name.to_string(), OutputEntry::Internal(InternalOutput::new()));
                changed = true;
            }
        }
        changed
    }

    /// 扫描物理输入端口并同步连接状态；返回设备表是否有变化。
    fn refresh_inputs(&mut self) -> bool {
        let mut changed = false;
        let mut found_inputs: Vec<String> = Vec::new();
        let mut has_loopback = false;

        let midi_in_ref = match self.midi_in.as_ref() {
            Some(m) => m,
            None => return false,
        };

        for port in midi_in_ref.ports() {
            if let Ok(name) = midi_in_ref.port_name(&port) {
                if name.contains(IGNORE_RTMIDI_REGEX) {
                    continue;
                }
                if IGNORE_INPUT_RE.is_match(&name) {
                    continue;
                }

                // Windows loopback 驱动会成对出现同名端口，只保留第一个
                let is_loopback = name.contains("Loopback");
                if is_loopback && has_loopback {
                    warn!("refresh_inputs: skipping duplicate loopback '{}'", name);
                    continue;
                }

                found_inputs.push(name.clone());
                if is_loopback {
                    has_loopback = true;
                }

                if let Some(existing) = self.inputs.get(&name) {
                    if !existing.connected {
                        self.inputs.get_mut(&name).unwrap().connected = true;
                        changed = true;
                    }
                } else {
                    self.inputs.insert(name.clone(), MidiInputDevice::new(name, true));
                    changed = true;
                }
            }
        }

        // 端口消失的设备标记为断开
        for input in self.inputs.values_mut() {
            if !found_inputs.contains(&input.name) && input.connected {
                input.connected = false;
                input.opened = false;
                changed = true;
            }
        }

        changed
    }

    /// 扫描物理输出端口并同步连接状态；返回设备表是否有变化。
    fn refresh_outputs(&mut self) -> bool {
        let mut changed = false;
        let mut found_outputs: Vec<String> = Vec::new();

        let midi_out_ref = match self.midi_out.as_ref() {
            Some(m) => m,
            None => return false,
        };

        for port in midi_out_ref.ports() {
            if let Ok(name) = midi_out_ref.port_name(&port) {
                if name.contains(IGNORE_RTMIDI_REGEX) {
                    continue;
                }

                found_outputs.push(name.clone());

                let existing = self.outputs.get(&name);
                match existing {
                    Some(OutputEntry::Physical(dev)) => {
                        if !dev.connected {
                            self.outputs
                                .get_mut(&name)
                                .unwrap()
                                .as_physical_mut()
                                .connected = true;
                            changed = true;
                        }
                    }
                    // 同名物理端口出现时覆盖内部占位
                    Some(OutputEntry::Internal(_)) => {
                        self.outputs
                            .insert(name.clone(), OutputEntry::Physical(MidiOutputDevice::new(name, true)));
                        changed = true;
                    }
                    None => {
                        self.outputs
                            .insert(name.clone(), OutputEntry::Physical(MidiOutputDevice::new(name, true)));
                        changed = true;
                    }
                }
            }
        }

        // 端口消失的物理输出标记为断开（内部输出不受影响）
        for (name, entry) in self.outputs.iter_mut() {
            if let OutputEntry::Physical(dev) = entry
                && !found_outputs.contains(name)
                && dev.connected
            {
                dev.connected = false;
                dev.opened = false;
                changed = true;
            }
        }

        changed
    }

    /// 获取输入设备列表（前端视角）。
    pub fn get_inputs(&self) -> Vec<ApiMidiInput> {
        self.inputs.values().map(|d| d.to_api()).collect()
    }

    /// 获取输出设备列表：任一内部输出存在时聚合为一项 "internal"。
    pub fn get_outputs(&self) -> Vec<ApiMidiOutput> {
        let mut outputs: Vec<ApiMidiOutput> = Vec::new();

        let has_internal = MODULE_OUTPUTS.iter().any(|name| self.outputs.contains_key(*name));
        if has_internal {
            outputs.push(ApiMidiOutput {
                name: "internal".to_string(),
                output_type: "internal".to_string(),
                opened: true,
                connected: true,
                error: false,
            });
        }

        for entry in self.outputs.values() {
            if let OutputEntry::Physical(dev) = entry {
                outputs.push(dev.to_api());
            }
        }

        outputs
    }

    /// 获取当前连线列表（前端视角）。
    pub fn get_wires(&self) -> Vec<ApiMidiWire> {
        self.wires.iter().map(|w| w.to_api()).collect()
    }
}

impl OutputEntry {
    /// 取物理设备可变引用；误用于内部输出时 panic（调用方已保证分支正确）。
    fn as_physical_mut(&mut self) -> &mut MidiOutputDevice {
        match self {
            OutputEntry::Physical(dev) => dev,
            OutputEntry::Internal(_) => panic!("Expected Physical output"),
        }
    }
}
