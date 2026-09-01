//! MIDI 路由数据模型：前后端 DTO（[`MidiRouteRaw`]）、内部模型（[`MidiRoute`]）
//! 与按 input 分组的纯函数（[`group_routes_by_input`]）。
//!
//! 原先 `ApiMidiRoute` 与 `MidiRouteRaw` 字段完全同构，已合并为单一 DTO。

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// 前后端交互的路由 DTO（合并了原 ApiMidiRoute）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MidiRouteRaw {
    pub input: String,
    pub output: String,
    #[serde(rename = "type")]
    pub route_type: String,
    pub enabled: bool,
}

/// 内部路由模型（不含 serde 派生，便于纯逻辑单元测试）。
#[derive(Debug, Clone)]
pub struct MidiRoute {
    pub input: String,
    pub output: String,
    pub route_type: String,
    pub enabled: bool,
}

impl MidiRoute {
    /// 从前端 DTO 构造内部模型。
    pub fn from_raw(raw: MidiRouteRaw) -> Self {
        Self {
            input: raw.input,
            output: raw.output,
            route_type: raw.route_type,
            enabled: raw.enabled,
        }
    }

    /// 判断两条路由是否指向同一 input/output/type（enabled 不参与比较）。
    pub fn is_same(&self, other: &Self) -> bool {
        self.route_type == other.route_type
            && self.input == other.input
            && self.output == other.output
    }

    /// 转回前端 DTO（供 wire 状态序列化）。
    pub fn to_api(&self) -> MidiRouteRaw {
        MidiRouteRaw {
            input: self.input.clone(),
            output: self.output.clone(),
            route_type: self.route_type.clone(),
            enabled: self.enabled,
        }
    }
}

/// 单条路由的目标抽象。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OutputTarget {
    /// 广播到全部内部模块输出
    Internal,
    /// 指定名称的物理输出设备
    Physical(String),
}

/// 按 input 名分组的路由目标集合（BTreeMap 保证确定性，便于 diff 与测试）。
pub type RouteGroups = BTreeMap<String, Vec<OutputTarget>>;

/// 将 enabled 路由按 input 分组；同一 input 的目标去重。
///
/// 这是多输出路由修复的基础：同一 input 的全部目标共享一条输入连接，
/// 输入回调内再把消息分发到每个目标（原先逐条路由各建一条连接，
/// 同 input 的后续连接会覆盖前面的，导致只有最后一个输出能收到消息）。
pub fn group_routes_by_input(routes: &[MidiRoute]) -> RouteGroups {
    let mut groups: RouteGroups = BTreeMap::new();
    for route in routes.iter().filter(|r| r.enabled) {
        let target = if route.route_type == "internal" {
            OutputTarget::Internal
        } else {
            OutputTarget::Physical(route.output.clone())
        };
        let entry = groups.entry(route.input.clone()).or_default();
        if !entry.contains(&target) {
            entry.push(target);
        }
    }
    groups
}

/// 组级 diff 结果：决定哪些 input 组需要重建、哪些可以保留现有连接。
#[derive(Debug, Default, PartialEq)]
pub struct GroupDiff {
    /// 需要断开并重建的 input（新增组或目标集变化的组）
    pub to_rebuild: Vec<String>,
    /// 目标集未变化、可保留现有连接的 input
    pub kept: Vec<String>,
    /// 已被移除的 input（旧分组中存在、新分组中不存在）
    pub removed: Vec<String>,
}

/// 比较新旧分组：input 的目标集合（无序）一致则保留，否则重建。
///
/// 这是增量路由的基础：单条路由增删时，只有受影响的 input 组
/// 会断开重建，其余组的连接保持原样（零中断）。
pub fn diff_groups(old: &RouteGroups, new: &RouteGroups) -> GroupDiff {
    let mut diff = GroupDiff::default();
    for (input, new_targets) in new {
        match old.get(input) {
            Some(old_targets) if targets_equal(old_targets, new_targets) => {
                diff.kept.push(input.clone());
            }
            _ => diff.to_rebuild.push(input.clone()),
        }
    }
    for input in old.keys() {
        if !new.contains_key(input) {
            diff.removed.push(input.clone());
        }
    }
    diff
}

/// 目标集合无序相等判断（分组内目标已去重，长度一致 + 单向包含即可）。
fn targets_equal(a: &[OutputTarget], b: &[OutputTarget]) -> bool {
    a.len() == b.len() && a.iter().all(|t| b.contains(t))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn route(input: &str, output: &str, route_type: &str) -> MidiRoute {
        MidiRoute {
            input: input.into(),
            output: output.into(),
            route_type: route_type.into(),
            enabled: true,
        }
    }

    #[test]
    fn groups_by_input_and_dedups_targets() {
        let routes = vec![
            route("in1", "outA", "physical"),
            route("in1", "outB", "physical"),
            route("in1", "outA", "physical"), // 重复目标应去重
            route("in2", "internal-x", "internal"),
        ];
        let groups = group_routes_by_input(&routes);
        assert_eq!(groups.len(), 2);
        assert_eq!(
            groups["in1"],
            vec![
                OutputTarget::Physical("outA".into()),
                OutputTarget::Physical("outB".into())
            ]
        );
        assert_eq!(groups["in2"], vec![OutputTarget::Internal]);
    }

    #[test]
    fn skips_disabled_routes() {
        let mut r = route("in1", "outA", "physical");
        r.enabled = false;
        let groups = group_routes_by_input(&[r]);
        assert!(groups.is_empty());
    }

    #[test]
    fn diff_all_new_when_old_empty() {
        let old = RouteGroups::new();
        let mut new = RouteGroups::new();
        new.insert("in1".into(), vec![OutputTarget::Internal]);
        let d = diff_groups(&old, &new);
        assert_eq!(d.to_rebuild, vec!["in1".to_string()]);
        assert!(d.kept.is_empty());
        assert!(d.removed.is_empty());
    }

    #[test]
    fn diff_keeps_unchanged_rebuilds_changed_removes_gone() {
        let mut old = RouteGroups::new();
        old.insert("in1".into(), vec![OutputTarget::Physical("outA".into())]);
        old.insert("in2".into(), vec![OutputTarget::Internal]);
        old.insert("in3".into(), vec![OutputTarget::Internal]);

        let mut new = RouteGroups::new();
        // in1 目标变化 → 重建；in2 保持 → 保留；in3 消失 → 移除
        new.insert("in1".into(), vec![OutputTarget::Physical("outB".into())]);
        new.insert("in2".into(), vec![OutputTarget::Internal]);

        let d = diff_groups(&old, &new);
        assert_eq!(d.to_rebuild, vec!["in1".to_string()]);
        assert_eq!(d.kept, vec!["in2".to_string()]);
        assert_eq!(d.removed, vec!["in3".to_string()]);
    }

    #[test]
    fn diff_treats_reordered_targets_as_equal() {
        let mut old = RouteGroups::new();
        old.insert(
            "in1".into(),
            vec![
                OutputTarget::Physical("outA".into()),
                OutputTarget::Physical("outB".into()),
            ],
        );
        let mut new = RouteGroups::new();
        new.insert(
            "in1".into(),
            vec![
                OutputTarget::Physical("outB".into()),
                OutputTarget::Physical("outA".into()),
            ],
        );
        let d = diff_groups(&old, &new);
        assert_eq!(d.kept, vec!["in1".to_string()]);
        assert!(d.to_rebuild.is_empty());
    }
}
