//! MIDI 连接建立：物理输出连接与按 input 分组的共享输入连接。
//!
//! 核心设计：同一 input 的全部路由目标共享**一条**输入连接，
//! 输入回调内把消息分发到该 input 的每个目标（内部广播 + 物理转发）。
//! 这修复了原先"同 input 多输出时后建连接覆盖前建连接、
//! 只有最后一个输出能收到消息"的缺陷。

use log::{debug, error, info, trace, warn};
use midir::{MidiInput, MidiOutput};
use tauri::{AppHandle, Emitter};

use crate::midi::route::OutputTarget;
use super::{MidiDeviceManager, OutputEntry, MODULE_OUTPUTS};

/// 为一个 input 组建立连接：先建物理输出连接，再建共享的输入连接。
///
/// 对设备表 `inputs`/`outputs` 的 opened/error 状态就地更新；
/// 该 input 组的全部 wire 成功后标记为已连接。
pub(super) fn establish_group_connection(
    manager: &mut MidiDeviceManager,
    input_name: &str,
    targets: &[OutputTarget],
    app_handle: &AppHandle,
) {
    debug!(
        "establish_group_connection: input='{}' targets={:?}",
        input_name, targets
    );

    // Step 1: 物理输出连接先行建立（幂等：已存在则跳过）
    for target in targets {
        if let OutputTarget::Physical(output_name) = target
            && !manager
                .active_output_connections
                .lock()
                .unwrap()
                .contains_key(output_name)
        {
            connect_physical_output(manager, output_name);
        }
    }

    // Step 2: 查找输入端口
    let midi_in = match MidiInput::new("midi-jar-route") {
        Ok(m) => m,
        Err(e) => {
            error!(
                "establish_group_connection: FAILED to create MidiInput for '{}': {:?}",
                input_name, e
            );
            if let Some(dev) = manager.inputs.get_mut(input_name) {
                dev.error = true;
            }
            return;
        }
    };

    let target_port = midi_in.ports().into_iter().find(|p| {
        midi_in.port_name(p).ok().as_deref() == Some(input_name)
    });

    let port = match target_port {
        Some(p) => {
            debug!("establish_group_connection: FOUND port for '{}'", input_name);
            p
        }
        None => {
            error!("establish_group_connection: PORT NOT FOUND for '{}'", input_name);
            error!("establish_group_connection: available ports:");
            if let Ok(midi_in2) = MidiInput::new("midi-jar-debug") {
                for p in midi_in2.ports() {
                    if let Ok(name) = midi_in2.port_name(&p) {
                        error!("  '{}'", name);
                    }
                }
            }
            if let Some(dev) = manager.inputs.get_mut(input_name) {
                dev.error = true;
            }
            return;
        }
    };

    // Step 3: 组装回调闭包——捕获该 input 的全部目标（多输出修复点）
    let app_handle_clone = app_handle.clone();
    let input_name_clone = input_name.to_string();
    let dedup_clone = manager.dedup.clone();
    let output_connections_clone = manager.active_output_connections.clone();
    let physical_outputs: Vec<String> = targets
        .iter()
        .filter_map(|t| match t {
            OutputTarget::Physical(name) => Some(name.clone()),
            OutputTarget::Internal => None,
        })
        .collect();
    let has_internal = targets.iter().any(|t| matches!(t, OutputTarget::Internal));

    debug!(
        "establish_group_connection: calling midi_in.connect() for '{}'",
        input_name
    );

    let conn_result = midi_in.connect(
        &port,
        "midi-jar-route",
        move |stamp, message, _| {
            let timestamp = (stamp as f64) * 1000.0;

            // 去重：窗口内相同消息只处理一次（去重后再分发到全部目标）
            {
                let mut dedup = dedup_clone.lock().unwrap();
                if dedup.is_duplicate(message, timestamp as u128) {
                    trace!(
                        ">>> DEDUP SKIP device='{}' message={:?}",
                        input_name_clone,
                        message
                    );
                    return;
                }
            }

            trace!(
                ">>> MIDI CALLBACK device='{}' timestamp={} message={:?}",
                input_name_clone,
                timestamp,
                message
            );

            // 内部路由：广播到全部模块输出
            if has_internal {
                for &module_name in MODULE_OUTPUTS {
                    let event_name = format!("midi:message:{}", module_name);
                    trace!(">>> emitting '{}' message={:?}", event_name, message);
                    let _ = app_handle_clone.emit(
                        &event_name,
                        serde_json::json!({
                            "message": message,
                            "timestamp": timestamp,
                            "device": &input_name_clone
                        }),
                    );
                }
            }

            // 物理路由：向该 input 的全部物理输出发送
            if !physical_outputs.is_empty() {
                let mut connections = output_connections_clone.lock().unwrap();
                for output_name in &physical_outputs {
                    match connections.get_mut(output_name) {
                        Some(conn) => {
                            trace!(
                                ">>> sending to physical output '{}' message={:?}",
                                output_name,
                                message
                            );
                            if let Err(e) = conn.send(message) {
                                error!(">>> FAILED to send to '{}': {}", output_name, e);
                            }
                        }
                        None => warn!(">>> output connection '{}' not found", output_name),
                    }
                }
                drop(connections); // 先释放锁再 emit，避免回调内长持锁
            }

            let _ = app_handle_clone.emit(
                "midi:activity",
                serde_json::json!({
                    "latency": 0.0,
                    "device": &input_name_clone
                }),
            );
        },
        (),
    );

    match conn_result {
        Ok(conn) => {
            info!(
                "establish_group_connection: SUCCESS - connected to '{}'",
                input_name
            );
            manager.active_connections.insert(input_name.to_string(), conn);
            // 该 input 组的全部 wire 标记为已连接
            for wire in manager.wires.iter_mut() {
                if wire.route.input == input_name {
                    wire.connected = true;
                }
            }
            if let Some(dev) = manager.inputs.get_mut(input_name) {
                dev.opened = true;
                debug!(
                    "establish_group_connection: marked input '{}' as opened",
                    input_name
                );
            }
        }
        Err(e) => {
            error!(
                "establish_group_connection: FAILED to connect to '{}': {}",
                input_name, e
            );
            if let Some(dev) = manager.inputs.get_mut(input_name) {
                dev.error = true;
            }
        }
    }
}

/// 建立指定物理输出的输出连接（已存在时不重复建立）。
fn connect_physical_output(manager: &mut MidiDeviceManager, output_name: &str) {
    debug!("connect_physical_output: connecting to '{}'", output_name);

    let midi_out = match MidiOutput::new("midi-jar-output") {
        Ok(m) => m,
        Err(e) => {
            error!("connect_physical_output: FAILED to create MidiOutput: {:?}", e);
            return;
        }
    };

    let out_port = midi_out
        .ports()
        .into_iter()
        .find(|p| midi_out.port_name(p).ok().as_deref() == Some(output_name));

    let Some(port_ref) = out_port else {
        warn!("connect_physical_output: output port '{}' not found", output_name);
        return;
    };

    match midi_out.connect(&port_ref, "midi-jar-output") {
        Ok(conn) => {
            info!(
                "connect_physical_output: SUCCESS - connected to output '{}'",
                output_name
            );
            manager
                .active_output_connections
                .lock()
                .unwrap()
                .insert(output_name.to_string(), conn);
            if let Some(OutputEntry::Physical(dev)) = manager.outputs.get_mut(output_name) {
                dev.opened = true;
            }
        }
        Err(e) => {
            error!(
                "connect_physical_output: FAILED to connect output '{}': {}",
                output_name, e
            );
        }
    }
}
