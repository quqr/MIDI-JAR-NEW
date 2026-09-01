//! MIDI 路由增量编排：diff 新旧分组，只重建受影响的 input 组。
//!
//! 增量策略（避免全量重建造成的 MIDI 中断）：
//! - 与现有连线目标集一致的 input 组**保留**现有连接；
//! - 新增/目标集变化的组才断开重建（见 [`connection`]）；
//! - 已移除的组断开其输入连接；
//! - 物理输出连接按引用计数关闭：不再被任何新组引用的输出才断开。
//!
//! 连接建立细节（端口查找、回调分发）在子模块 [`connection`]。

use std::collections::HashSet;

use log::debug;

use crate::midi::route::{diff_groups, group_routes_by_input, MidiRoute, OutputTarget};
use crate::midi::wire::{ApiMidiWire, MidiWire};
use super::connection::establish_group_connection;
use super::MidiDeviceManager;

impl MidiDeviceManager {
    /// 增量应用一组路由，返回最新 wire 列表（由调用方在锁外 emit）。
    pub fn route_midi(&mut self, routes: &[MidiRoute], app_handle: &tauri::AppHandle) -> Vec<ApiMidiWire> {
        let new_groups = group_routes_by_input(routes);
        // 从现有 wires 还原“当前已应用”的分组
        let old_groups = {
            let old_routes: Vec<MidiRoute> = self.wires.iter().map(|w| w.route.clone()).collect();
            group_routes_by_input(&old_routes)
        };
        let diff = diff_groups(&old_groups, &new_groups);
        debug!(
            "route_midi: {} routes, {} groups (rebuild={}, kept={}, removed={})",
            routes.len(),
            new_groups.len(),
            diff.to_rebuild.len(),
            diff.kept.len(),
            diff.removed.len()
        );

        // 1. 断开被移除/目标变化组的输入连接（连接对象 drop 即断开）
        for input in diff.removed.iter().chain(&diff.to_rebuild) {
            self.active_connections.remove(input);
        }

        // 2. 输出连接引用计数关闭：仅断开不再被任何新组引用的物理输出
        let referenced_outputs: HashSet<String> = new_groups
            .values()
            .flatten()
            .filter_map(|t| match t {
                OutputTarget::Physical(name) => Some(name.clone()),
                OutputTarget::Internal => None,
            })
            .collect();
        self.active_output_connections
            .lock()
            .unwrap()
            .retain(|name, _| referenced_outputs.contains(name));

        // 3. 重建 wires：kept 组沿用旧 connected 状态，其余先置 false
        let kept: HashSet<&String> = diff.kept.iter().collect();
        let was_connected: HashSet<(String, String, String)> = self
            .wires
            .iter()
            .filter(|w| w.connected)
            .map(|w| {
                (
                    w.route.input.clone(),
                    w.route.output.clone(),
                    w.route.route_type.clone(),
                )
            })
            .collect();
        self.wires = routes
            .iter()
            .filter(|r| r.enabled)
            .map(|r| MidiWire {
                route: r.clone(),
                connected: kept.contains(&r.input)
                    && was_connected.contains(&(
                        r.input.clone(),
                        r.output.clone(),
                        r.route_type.clone(),
                    )),
            })
            .collect();

        // 4. 为新增/变化的组建立连接（kept 组连接原样保留，零中断）
        for input in &diff.to_rebuild {
            if let Some(targets) = new_groups.get(input) {
                debug!("route_midi: rebuilding group '{}' -> {:?}", input, targets);
                establish_group_connection(self, input, targets, app_handle);
            }
        }

        debug!("route_midi: {} wires final", self.wires.len());
        self.get_wires()
    }
}
