use serde::{Deserialize, Serialize};
use crate::MidiRouteRaw;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMidiRoute {
    pub input: String,
    pub output: String,
    #[serde(rename = "type")]
    pub route_type: String,
    pub enabled: bool,
}

#[derive(Debug, Clone)]
pub struct MidiRoute {
    pub input: String,
    pub output: String,
    pub route_type: String,
    pub enabled: bool,
}

impl MidiRoute {
    pub fn from_raw(raw: MidiRouteRaw) -> Self {
        Self {
            input: raw.input,
            output: raw.output,
            route_type: raw.route_type,
            enabled: raw.enabled,
        }
    }

    pub fn is_same(&self, other: &Self) -> bool {
        self.route_type == other.route_type && self.input == other.input && self.output == other.output
    }

    pub fn to_api(&self) -> ApiMidiRoute {
        ApiMidiRoute {
            input: self.input.clone(),
            output: self.output.clone(),
            route_type: self.route_type.clone(),
            enabled: self.enabled,
        }
    }
}
