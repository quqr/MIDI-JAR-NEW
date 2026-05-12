use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMidiInput {
    pub name: String,
    pub opened: bool,
    pub connected: bool,
    pub error: bool,
}

pub struct MidiInputDevice {
    pub name: String,
    pub connected: bool,
    pub opened: bool,
    pub error: bool,
}

impl MidiInputDevice {
    pub fn new(name: String, connected: bool) -> Self {
        Self {
            name,
            connected,
            opened: false,
            error: false,
        }
    }

    pub fn to_api(&self) -> ApiMidiInput {
        ApiMidiInput {
            name: self.name.clone(),
            opened: self.opened,
            connected: self.connected,
            error: self.error,
        }
    }
}
