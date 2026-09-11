//! VST3 插件宿主管理：插件实例生命周期、编辑器窗口服务与音频流持有。
//!
//! 设计要点（ADR 0021 / ADR 0022）：
//! - 插件作为**音色后端**存在，与内置采样器互斥；本模块只管"实例"，不决定发声时机。
//! - **本模块运行在 `vst-host` 子进程里**（ADR 0022 进程隔离）：坏插件的 native
//!   崩溃只杀子进程，主程序存活并由 [`super::bridge`] 兜底重启。编辑器窗口与音频流
//!   同在子进程，编辑器是子进程的独立顶层浮动窗口。
//! - 编辑器窗口需**逐帧服务**：`service_platform_events()` 处理插件的 resize / DPI
//!   变更请求，`closed_by_user()` 检测用户点标题栏关窗——crate 不会主动通知宿主。
//!   由子进程主循环（[`super::child`]）以 ~16ms 间隔轮询。
//! - 用户关窗 = **仅关闭编辑器**，插件继续发声并接收 MIDI；卸载是独立操作。
//!
//! # Threading 约束（子进程内）
//!
//! [`VstManager`] 仍含两个 `!Send` 成员（`HWND` 与擦除后的音频流句柄，见下方
//! 历史注释），因此管理器固定在**子进程主线程**：stdin 读取线程把请求经 mpsc
//! 递给主循环，主循环串行处理请求并轮询编辑器——与旧版"主线程 + on_main 转发"
//! 同构，只是范围缩小到了子进程内部。

use std::sync::{Arc, Mutex};

use log::{debug, info, warn};
use vst3_host::{Plugin, PluginWindow};

/// 编辑器窗口轮询间隔（约 60fps）。
///
/// `service_platform_events()` 是非阻塞的：若插件锁被音频回调持有则直接返回，
/// 待下次轮询再处理——因此该间隔只影响插件窗口响应速度，不影响音频。
/// 由子进程主循环（[`super::child`]）使用。
pub(crate) const EDITOR_SERVICE_INTERVAL_MS: u64 = 16;

/// 插件实例的运行状态。
///
/// 前端的"音色来源"切换只关心"有没有可用实例"，故状态机保持扁平。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VstStatus {
    /// 未加载任何插件。
    Empty,
    /// 已加载且音频流正常。
    Running,
    /// 已加载但出错（音频设备打开失败、插件进程崩溃且恢复失败等）。
    Error(String),
}

impl VstStatus {
    /// 序列化为前端友好的形状（`{ state, message }`）。
    pub fn to_payload(&self) -> serde_json::Value {
        match self {
            Self::Empty => serde_json::json!({ "state": "empty", "message": null }),
            Self::Running => serde_json::json!({ "state": "running", "message": null }),
            Self::Error(msg) => {
                serde_json::json!({ "state": "error", "message": msg })
            }
        }
    }
}

/// 一个已加载插件实例的完整形态：插件本体 + 编辑器窗口 + 音频流。
///
/// `audio` 持 [`vst3_host::AudioHandle`]——**drop 即停止发声**，故必须与实例同生命周期。
struct LoadedPlugin {
    /// 插件路径（用于前端展示与状态恢复）。
    path: String,
    /// 插件显示名（厂商提供的名称，非文件名）。
    name: String,
    /// 插件厂商。
    vendor: String,
    /// 共享句柄：编辑器窗口与音频路径都需要访问同一实例。
    plugin: Arc<Mutex<Plugin>>,
    /// 编辑器窗口；`None` = 当前未打开（用户关窗或从未打开）。
    window: Option<PluginWindow>,
    /// 音频流句柄；`None` = 未启动（加载失败或已停）。
    audio: Option<vst3_host::AudioHandle>,
    /// 是否正在服务编辑器窗口（避免重复 spawn 轮询线程）。
    editor_serviced: bool,
}

/// VST3 宿主管理器：应用级单例，持有至多一个插件实例。
///
/// 单实例是刻意的：音色来源是"用哪一类音源"，插件层面只需一个"当前插件"。
/// 多实例会让"谁在发声"重新变模糊，与 ADR 0021 的互斥语义冲突。
pub struct VstManager {
    current: Option<LoadedPlugin>,
    status: VstStatus,
}

impl VstManager {
    /// 创建空管理器（不加载任何插件）。
    pub fn new() -> Self {
        Self {
            current: None,
            status: VstStatus::Empty,
        }
    }

    /// 当前状态快照（供 `get_vst_status` 与 `vst:status` 事件）。
    pub fn status(&self) -> VstStatus {
        self.status.clone()
    }

    /// 当前插件信息（未加载时返回 `None`）。
    pub fn current_info(&self) -> Option<serde_json::Value> {
        self.current.as_ref().map(|p| {
            serde_json::json!({
                "path": p.path,
                "name": p.name,
                "vendor": p.vendor,
                "editorOpen": p.window.as_ref().map(|w| w.is_open()).unwrap_or(false),
                "audioRunning": p.audio.is_some(),
            })
        })
    }

    /// 卸载当前插件：停止音频、关闭编辑器、释放实例。
    ///
    /// 显式卸载（而非静默丢弃）是必要的——见 [`VstManager::load`] 的卸载延迟说明。
    pub fn unload(&mut self) {
        if let Some(mut p) = self.current.take() {
            info!("vst: unloading plugin '{}'", p.name);
            // 顺序要紧：先停音频（可能持有插件锁），再关编辑器（内部会 close_editor）。
            p.audio = None;
            if let Some(mut w) = p.window.take() {
                w.close();
            }
            drop(p);
        }
        self.status = VstStatus::Empty;
    }

    /// 加载插件并启动音频流。
    ///
    /// 成功返回 `Ok(())`；失败返回错误字符串，同时 `status` 置为
    /// [`VstStatus::Error`]（前端据此进入错误态，而非静默无声）。
    ///
    /// 音频流与插件**同时**建立：本应用不需要"加载了但不出声"的中间态。
    pub fn load(&mut self, path: &str, should_open_editor: bool) -> Result<(), String> {
        // 换插件 = 卸载旧的（这是"真正卸载"的触发点之一）
        self.unload();

        // 任何一步失败都进入显式错误态：前端据此停止向本插件投递 MIDI 并提示重载，
        // 而不是让用户面对"什么都没发生"的静默无声。
        match self.load_inner(path, should_open_editor) {
            Ok(()) => Ok(()),
            Err(e) => {
                warn!("vst: load failed for '{path}': {e}");
                self.status = VstStatus::Error(e.clone());
                Err(e)
            }
        }
    }

    /// [`Self::load`] 的实现体：不负责错误态包装。
    fn load_inner(&mut self, path: &str, should_open_editor: bool) -> Result<(), String> {
        // ── 1. 构建宿主并加载插件 ──
        // 采样率 44100 / 块 512：与 vst3-host 的 simple 默认一致，此处显式化。
        //
        // 进程隔离由**外层**实现（ADR 0022）：本代码整体运行在 vst-host 子进程里，
        // 加载的 DLL 崩溃只带走子进程。crate 自带的 `vst3-host-helper` 隔离不可用
        // （依赖包 `[[bin]]` 不随上层包构建 + Windows 不支持跨进程编辑器桥接），
        // 故采用"自托管子进程 + 浮动编辑器"方案。
        let mut host = vst3_host::Vst3Host::builder()
            .sample_rate(44100.0)
            .block_size(512)
            .input_channels(0)
            .output_channels(2)
            .build()
            .map_err(|e| format!("failed to build VST host: {e}"))?;

        let plugin = host
            .load_plugin(path)
            .map_err(|e| format!("failed to load plugin '{path}': {e}"))?;

        let info = plugin.info().clone();
        let name = info.name.clone();
        let vendor = info.vendor.clone();
        info!("vst: loaded plugin '{}' by '{}'", name, vendor);

        // ── 2. 启动音频流 ──
        // `play()` 消费 Plugin，但 `AudioHandle::plugin()` 会把共享句柄还给我们——
        // 这正是音频路径与编辑器窗口能指向同一实例的桥梁。
        let audio = host
            .play(plugin)
            .map_err(|e| format!("failed to start audio: {e}"))?;
        info!("vst: audio stream started for '{}'", name);

        // 从音频句柄取回共享实例，供编辑器窗口使用
        let plugin = audio.plugin();

        self.current = Some(LoadedPlugin {
            path: path.to_string(),
            name,
            vendor,
            plugin,
            window: None,
            audio: Some(audio),
            editor_serviced: false,
        });
        self.status = VstStatus::Running;

        // ── 3. 打开编辑器窗口 ──
        // 编辑器打不开不算致命（插件已在发声），失败只记日志、不整体失败。
        if should_open_editor
            && let Err(e) = self.open_editor()
        {
            warn!("vst: plugin loaded but editor unavailable: {e}");
        }

        Ok(())
    }

    /// 打开编辑器窗口（幂等：已打开则无操作）。
    ///
    /// **必须在主线程调用**（创建 `HWND`）。
    /// 编辑器打不开不算致命——插件仍可发声，仅记录并返回错误供前端提示。
    pub fn open_editor(&mut self) -> Result<(), String> {
        let Some(p) = self.current.as_mut() else {
            return Err("no plugin loaded".to_string());
        };
        if let Some(w) = p.window.as_ref() {
            if w.is_open() {
                return Ok(());
            }
            // 用户之前关过窗：句柄仍在但窗口已消失，先清理再重开
            if let Some(mut old) = p.window.take() {
                old.close();
            }
        }

        let mut w = PluginWindow::new(Arc::clone(&p.plugin));
        w.open().map_err(|e| {
            let msg = format!("failed to open editor: {e}");
            warn!("vst: {msg}");
            msg
        })?;
        info!("vst: editor window opened for '{}'", p.name);
        p.window = Some(w);
        p.editor_serviced = true;
        Ok(())
    }

    /// 关闭编辑器窗口（**不卸载插件**：插件继续发声、继续接收 MIDI）。
    ///
    /// **必须在主线程调用**。
    pub fn close_editor(&mut self) -> Result<(), String> {
        let Some(p) = self.current.as_mut() else {
            return Err("no plugin loaded".to_string());
        };
        match p.window.take() {
            Some(mut w) => {
                w.close();
                p.editor_serviced = false;
                info!("vst: editor window closed for '{}'", p.name);
                Ok(())
            }
            None => Ok(()), // 本就未打开
        }
    }

    /// 发送原始 MIDI 字节到当前插件。
    ///
    /// 字节由前端产出（`MidiMessageManager` 的既有格式）；此处解析后转成
    /// `MidiEvent`。解析失败（不完整的系统消息等）静默忽略，不打断演奏。
    pub fn send_midi(&mut self, bytes: &[u8]) -> Result<(), String> {
        let Some(p) = self.current.as_mut() else {
            return Err("no plugin loaded".to_string());
        };
        let Some(audio) = p.audio.as_ref() else {
            return Err("plugin has no audio stream".to_string());
        };

        let Some(event) = parse_midi_bytes(bytes) else {
            debug!("vst: ignored unparseable midi bytes {:?}", bytes);
            return Ok(());
        };

        // 无锁投递：不阻塞调用方，也不与音频线程抢锁
        if !audio.send_midi(event) {
            warn!("vst: midi command ring full, event dropped");
        }
        Ok(())
    }

    /// 停止并清除插件（供应用退出时调用）。
    pub fn shutdown(&mut self) {
        self.unload();
    }
}

impl Default for VstManager {
    fn default() -> Self {
        Self::new()
    }
}

/// 把原始 MIDI 字节解析为 `vst3_host::MidiEvent`。
///
/// 只处理通道消息（NoteOn / NoteOff / CC / ProgramChange / PitchBend /
/// ChannelAftertouch）——本应用的 MIDI 输入不会产生系统独占消息。
/// 返回 `None` 表示该字节序列不予转发。
fn parse_midi_bytes(bytes: &[u8]) -> Option<vst3_host::midi::MidiEvent> {
    use vst3_host::midi::{MidiChannel, MidiEvent};

    if bytes.len() < 2 {
        return None;
    }
    let status = bytes[0];
    // 通道消息：高 4 位是类型，低 4 位是通道（0-based → MidiChannel 1-based）
    let raw_channel = status & 0x0F;
    let channel = MidiChannel::from_index(raw_channel)?;
    let kind = status & 0xF0;

    match kind {
        0x80 => Some(MidiEvent::NoteOff {
            channel,
            note: *bytes.get(1)?,
            velocity: *bytes.get(2).unwrap_or(&0),
        }),
        0x90 => {
            let note = *bytes.get(1)?;
            let velocity = *bytes.get(2).unwrap_or(&0);
            // NoteOn velocity 0 在 MIDI 规范中等价于 NoteOff
            if velocity == 0 {
                Some(MidiEvent::NoteOff {
                    channel,
                    note,
                    velocity: 0,
                })
            } else {
                Some(MidiEvent::NoteOn {
                    channel,
                    note,
                    velocity,
                })
            }
        }
        0xB0 => Some(MidiEvent::ControlChange {
            channel,
            controller: *bytes.get(1)?,
            value: *bytes.get(2).unwrap_or(&0),
        }),
        0xC0 => Some(MidiEvent::ProgramChange {
            channel,
            program: *bytes.get(1)?,
        }),
        0xE0 => {
            let lsb = *bytes.get(1)? as u16;
            let msb = *bytes.get(2).unwrap_or(&0) as u16;
            Some(MidiEvent::PitchBend {
                channel,
                value: (msb << 7) | lsb,
            })
        }
        0xD0 => Some(MidiEvent::ChannelAftertouch {
            channel,
            pressure: *bytes.get(1)?,
        }),
        // 其他（含系统消息）不转发
        _ => None,
    }
}

/// 编辑器窗口服务：一轮轮询。
///
/// **必须持续被调用**（子进程主循环以 ~16ms 间隔驱动）：`service_platform_events()`
/// 处理插件的 resize / DPI 请求，`closed_by_user()` 检测用户关窗——crate 不会
/// 主动通知宿主。Windows 上关窗检测依赖窗口过程填充的 `close_requests()` 全局表，
/// 一旦停止轮询，该事件**永久丢失**。
///
/// 用户关窗时只释放窗口句柄，**不卸载插件**——插件继续发声、继续接收 MIDI。
///
/// 返回 `true` 表示状态发生变化（子进程主循环据此向前端推送快照）。
pub(crate) fn service_editor_once(mgr: &mut VstManager) -> bool {
    let Some(p) = mgr.current.as_mut() else {
        return false;
    };

    // 1. 检测用户关窗：释放句柄，插件保活
    let dismissed = p
        .window
        .as_ref()
        .map(|w| w.closed_by_user())
        .unwrap_or(false);
    if dismissed {
        info!("vst: editor window closed by user (plugin stays loaded)");
        if let Some(mut w) = p.window.take() {
            w.close();
        }
        p.editor_serviced = false;
        return true;
    }

    // 2. 服务平台请求（resize / DPR）
    if let Some(w) = p.window.as_ref()
        && let Err(e) = w.service_platform_events()
    {
        warn!("vst: service_platform_events failed: {e}");
    }

    false
}
