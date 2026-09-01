//! MIDI 连线（wire）模型：路由 + 连接状态。

use serde::{Deserialize, Serialize};

use super::route::{MidiRoute, MidiRouteRaw};

/// 前端可见的连线状态：路由 + 是否已建立连接。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMidiWire {
    pub route: MidiRouteRaw,
    pub connected: bool,
}

/// 内部连线模型。
pub struct MidiWire {
    pub route: MidiRoute,
    pub connected: bool,
}

impl MidiWire {
    /// 转为前端 DTO。
    pub fn to_api(&self) -> ApiMidiWire {
        ApiMidiWire {
            route: self.route.to_api(),
            connected: self.connected,
        }
    }
}
