//! MIDI 输出设备模型：内部设备状态 + 前端 DTO（[`ApiMidiOutput`]）。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMidiOutput {
    pub name: String,
    #[serde(rename = "type")]
    pub output_type: String,
    pub opened: bool,
    pub connected: bool,
    pub error: bool,
}

pub struct MidiOutputDevice {
    pub name: String,
    pub connected: bool,
    pub opened: bool,
    pub error: bool,
}

impl MidiOutputDevice {
    pub fn new(name: String, connected: bool) -> Self {
        Self {
            name,
            connected,
            opened: false,
            error: false,
        }
    }

    pub fn to_api(&self) -> ApiMidiOutput {
        ApiMidiOutput {
            name: self.name.clone(),
            output_type: "physical".to_string(),
            opened: self.opened,
            connected: self.connected,
            error: self.error,
        }
    }
}
