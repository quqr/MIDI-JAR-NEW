use serde::{Deserialize, Serialize};
use super::route::ApiMidiRoute;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMidiWire {
    pub route: ApiMidiRoute,
    pub connected: bool,
}

pub struct MidiWire {
    pub route: super::route::MidiRoute,
    pub connected: bool,
}

impl MidiWire {
    pub fn new(route: super::route::MidiRoute) -> Self {
        Self {
            route,
            connected: false,
        }
    }

    pub fn to_api(&self) -> ApiMidiWire {
        ApiMidiWire {
            route: self.route.to_api(),
            connected: self.connected,
        }
    }
}
