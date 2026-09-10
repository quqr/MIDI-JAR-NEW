//! VST3 插件宿主管理：插件实例生命周期、编辑器窗口服务与音频流持有。
//!
//! 设计要点（ADR 0021）：
//! - 插件作为**音色后端**存在，与内置采样器互斥；本模块只管"实例"，不决定发声时机。
//! - 编辑器窗口需**逐帧服务**：`service_platform_events()` 处理插件的 resize / DPI
//!   变更请求，`closed_by_user()` 检测用户点标题栏关窗——crate 不会主动通知宿主。
//!   两者都由 [`spawn_editor_service_loop`] 统一轮询。
//! - 用户关窗 = **仅关闭编辑器**，插件继续发声并接收 MIDI；卸载是独立操作。
//!
//! # Threading spike：为什么管理器暂时进不了 Tauri 受管状态
//!
//! [`VstManager`] 目前含两个 `!Send` 成员，必须留在创建它的线程上：
//!
//! | 成员 | 来源 | 为何 `!Send` |
//! | --- | --- | --- |
//! | `PluginWindow` 里的 `HWND` | winapi 裸句柄 | Windows 窗口句柄具有线程亲和性 |
//! | `Option<AudioHandle>` | cpal 输出流 | 见下 |
//!
//! `AudioHandle` 的 `!Send` 是**上游类型擦除的产物，不是 cpal 的限制**：
//! cpal 0.18 起 Windows 上的 `cpal::Stream` 已经是 `Send`（已用编译期断言验证），
//! 但 `vst3-host` 把它塞进 `Box<dyn AudioStream>`——`AudioStream` trait 没有
//! `Send` bound，而 `Box<dyn Trait>` 只实现所声明 trait 的超 trait，于是
//! `downcast` 也救不回来。同一份代码在 macOS/Linux 后端同样是 `!Send`，
//! 所以这不是 Windows 特有缺陷，而是 crate 的全局设计选择。
//!
//! 后果：`app.manage(Arc<Mutex<VstManager>>)` 无法编译（Tauri 受管状态要求
//! `Send + Sync + 'static`），`run_on_main_thread` 的闭包也无法跨线程传递管理器。
//!
//! ## 已排除的方案
//!
//! - **`unsafe impl Send for VstManager`**：纯属掩盖。Tauri 在**任意**工作线程
//!   drop 受管状态——那时 `AudioHandle` 会在非创建线程上析构，正是 cpal 文档
//!   警告的 UB 场景（其文档特别注明 drop 必须回到创建线程）。之所以禁止，是
//!   因为"能编译"与"正确"在这里恰好反向。
//! - **自实现 `AudioBackend`**：`vst3-host` 的 `play_with_backend` / `AudioConfig`
//!   是公开 API，这里能拿到**`Send` 的流**。但 `vst3-host` 的 `AudioStream` trait
//!   本身声明了 `fn downcast(self: Box<Self>) -> Box<dyn Any>` 且要求 `Any`
//!   （隐含 `'static`），而任何带生命周期的借用型后端都满足不了——除非其内部
//!   自己 `Arc` 持有全部状态。可做，但要重写一整条音频后端，收益与风险都不划算，
//!   除非后续确认"管理器必须跨线程"。
//! - **`Box::leak` / `mem::forget`**：泄漏句柄换 `'static`，永久占用 WASAPI 设备。
//!   退化成应用退出前一直在跑的第二条音频流，与内置采样器抢设备。
//!
//! ## 当前出路
//!
//! VST 子系统**整条链路固定在主线程**：命令、编辑器服务循环、音频流全部由主线程
//! 事件循环驱动（[`spawn_editor_service_loop`] 的模式）。管理器不进 Tauri 受管
//! 状态，改由 `thread_local!` 存放。代价是命令必须**从主线程调用**——Tauri 中
//! `#[tauri::command]` 默认在工作线程池里执行，因此每个 VST 命令都要显式做
//! "若不在主线程则转发"的包装（见 `commands/vst.rs`）。
//!
//! 一旦音频句柄被迁到专用音频线程、`VstManager` 只剩 `Send` 成员，本约束即解除，
//! 可以回到简单的 `app.manage(Arc<Mutex<VstManager>>)` 形态。

use std::sync::{Arc, Mutex};

use log::{debug, info, warn};
use vst3_host::{Plugin, PluginWindow};

/// 编辑器窗口轮询间隔（约 60fps）。
///
/// `service_platform_events()` 是非阻塞的：若插件锁被音频回调持有则直接返回，
/// 待下次轮询再处理——因此该间隔只影响插件窗口响应速度，不影响音频。
const EDITOR_SERVICE_INTERVAL_MS: u64 = 16;

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

thread_local! {
    /// 管理器的主线程存储。
    ///
    /// 见文件顶部 threading spike 注释：管理器 `!Send`，因此不能放进 Tauri 受管状态
    /// （Tauri 会把受管状态放到任意工作线程）。`thread_local` 天然满足
    /// "只有主线程能碰它"这条硬约束，代价是任何访问都必须先回到主线程。
    static MANAGER: std::cell::RefCell<Option<Arc<Mutex<VstManager>>>> =
        const { std::cell::RefCell::new(None) };
}

/// 在主线程创建管理器（幂等；重复调用只返回既有实例）。
pub fn install_manager() -> Arc<Mutex<VstManager>> {
    MANAGER.with(|cell| {
        let mut slot = cell.borrow_mut();
        slot.get_or_insert_with(|| Arc::new(Mutex::new(VstManager::new())))
            .clone()
    })
}

/// 取管理器；未创建时返回 `None`。
///
/// **必须在主线程调用**——`thread_local` 读到的是调用线程自己的槽位，
/// 在工作线程上取到的永远是 `None`（这正是我们想要的失败模式：安静地不动作，
/// 而不是跨线程触碰 `HWND`）。
pub fn manager() -> Option<Arc<Mutex<VstManager>>> {
    MANAGER.with(|cell| cell.borrow().as_ref().cloned())
}

/// 在主线程上对管理器做一次操作；管理器不存在时返回 `None`。
pub fn with_manager<R>(f: impl FnOnce(&mut VstManager) -> R) -> Option<R> {
    let mgr = manager()?;
    let mut guard = mgr.lock().ok()?;
    Some(f(&mut guard))
}

/// 当前线程是否为主线程。
///
/// Tauri 的命令默认在工作线程池执行，而 VST 子系统全部依赖主线程。命令层据此决定
/// "直接执行"还是"转发到主线程"。
pub fn is_main_thread() -> bool {
    MAIN_THREAD_ID.with(|id| *id.borrow() == Some(std::thread::current().id()))
}

thread_local! {
    /// 首次被主线程调用时惰性记录主线程 ID。
    static MAIN_THREAD_ID: std::cell::RefCell<Option<std::thread::ThreadId>> =
        const { std::cell::RefCell::new(None) };
}

/// 记录当前线程为主线程。必须在应用启动早期、从主线程调用一次。
pub fn mark_main_thread() {
    MAIN_THREAD_ID.with(|id| {
        let mut slot = id.borrow_mut();
        if slot.is_none() {
            *slot = Some(std::thread::current().id());
        }
    });
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
        // **不开进程隔离**（与 ADR 0021 的 I1 决策相悖，原因见下）：
        // Phase 0 实测发现两件事使隔离在 Windows 上不可用——
        //   ① `vst3-host-helper` 是**依赖包**的 `[[bin]]` 目标，Cargo 不会为上层包
        //      构建它；生产环境三条搜索路径全部落空，隔离必然启动失败。
        //   ② 即便 helper 就位，crate README 明说编辑器跨隔离边界打开
        //      "on macOS ...; Windows/Linux not yet"——本项目在 Windows，
        //      "隔离 + 编辑器"不可兼得。
        // 故当前采用 in-process，并用 UI 明示崩溃风险（见 VstStatus::Error 上报）。
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

/// 编辑器窗口服务循环。
///
/// **必须持续运行**：`service_platform_events()` 处理插件的 resize / DPI 请求，
/// `closed_by_user()` 检测用户关窗——crate 不会主动通知宿主。
/// Windows 上关窗检测依赖窗口过程填充的 `close_requests()` 全局表，
/// 一旦停止轮询，该事件**永久丢失**（这正是原 `mem::forget` 实现废掉的能力）。
///
/// 用户关窗时只释放窗口句柄，**不卸载插件**——插件继续发声、继续接收 MIDI。
///
/// # 为什么不用后台线程持有管理器
///
/// [`VstManager`] 内含 `HWND`（编辑器窗口）与 `dyn AudioStream`（cpal 流），
/// **两者都不是 `Send`**——Windows 窗口句柄具有线程亲和性，音频流亦不可跨线程移动。
/// 因此管理器必须留在主线程，本函数只负责**定时唤醒主线程**去服务编辑器。
///
/// 唤醒方式：每隔 [`EDITOR_SERVICE_INTERVAL_MS`] 向主线程投递一次服务请求，
/// 由主线程上的 [`service_editor_once`] 真正执行。
pub fn spawn_editor_service_loop(app: tauri::AppHandle) {
    use tauri::Emitter;

    // 定时线程只做"请求主线程跑一轮服务"，自己不碰管理器。
    //
    // 关键：闭包必须 `Send`，而管理器 `!Send`，所以**不能在闭包里捕获管理器**——
    // 由主线程在闭包内部自行去 `thread_local` 里取。见文件顶部 threading spike 注释。
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(
                EDITOR_SERVICE_INTERVAL_MS,
            ));

            let app_for_main = app.clone();
            if let Err(e) = app.run_on_main_thread(move || {
                let changed = with_manager(|mgr| service_editor_once(mgr)).unwrap_or(false);
                if changed
                    && let Some(mgr) = manager()
                    && let Ok(guard) = mgr.lock()
                {
                    let _ = app_for_main.emit("vst:status", guard.status.to_payload());
                }
            }) {
                // Tauri 已关闭：循环使命结束
                debug!("vst: editor service loop stopping ({e})");
                return;
            }
        }
    });
}

/// 服务一次编辑器窗口；返回 `true` 表示状态发生变化（需向前端广播）。
///
/// **必须在主线程调用**（触碰 `HWND` / 音频流）。
fn service_editor_once(mgr: &mut VstManager) -> bool {
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
