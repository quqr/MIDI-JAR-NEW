//! vst-host 子进程：宿主模式的入口与协议主循环（ADR 0022 进程隔离）。
//!
//! 由主程序以 `--vst-host` 参数**自复用**启动（见 `main.rs`）——同一可执行文件，
//! 无需打包第二个二进制。本进程承载全部危险逻辑（vst3-host 加载 DLL、cpal 音频流、
//! 插件编辑器浮窗），崩溃只带走自己，主进程由 [`super::bridge`] 兜底。
//!
//! # 结构
//!
//! - **stdin 读取线程**：逐行解析请求，经 mpsc 递给主线程（自己绝不触碰 `!Send`
//!   的管理器）；
//! - **主线程**：以 ~16ms 周期轮询编辑器窗口（`service_platform_events` /
//!   `closed_by_user`），同时处理请求队列；状态变化时向 stdout 推 `snapshot` 事件。
//!
//! 编辑器是本进程内的**独立顶层浮动窗口**——插件 DLL 与窗口同进程，不涉及
//! 跨进程编辑器桥接（vst3-host 仅在 macOS 支持，本项目在 Windows）。

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{Value, json};

use super::host::{EDITOR_SERVICE_INTERVAL_MS, VstManager, service_editor_once};
use super::scan::introspect_plugins;

/// Windows 编辑器窗口消息泵。
///
/// 编辑器 `HWND` 在 `vst-host` **主线程**创建（见 [`super::host`] 的 `open_editor`），
/// 而 `vst3-host` 的 `PluginWindow::open()` 只做 `CreateWindowExW` + `ShowWindow`，
/// 自身**不泵消息**——其 `service_platform_events()` 文档明确要求宿主"在自己的 UI
/// 事件循环里每帧调用"。旧实现主循环没有 Win32 消息泵，窗口消息（WM_PAINT / 鼠标 /
/// 键盘 / 计时器）从未被 `DispatchMessage` 分派，插件编辑器因此完全无响应（卡死）。
///
/// 这里用非阻塞的 `PeekMessageW(PM_REMOVE)` 抽干当前线程队列并分派，配合主循环
/// 每 ~16ms 的轮询≈60fps，足够流畅；刻意**不**用会阻塞的 `GetMessageW`，以免拖慢
/// 对 stdin 命令的处理。窗口过程 `plugin_window_proc` 不持插件锁，分派安全。
#[cfg(windows)]
mod win_pump {
    use std::ptr;
    use winapi::um::winuser::{DispatchMessageW, MSG, PeekMessageW, TranslateMessage, PM_REMOVE};

    /// 抽干并分派当前线程消息队列里的所有待处理消息（非阻塞）。
    pub(crate) fn pump() {
        unsafe {
            let mut msg: MSG = std::mem::zeroed();
            while PeekMessageW(&mut msg, ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
    }
}

/// stdout 写锁：主线程是唯一写者，加锁仅为防御性（未来多写者不踩线）。
type StdoutLock = Mutex<()>;

/// 子进程入口：阻塞直到收到 `shutdown` 请求或 stdin 关闭。
pub(crate) fn run() {
    init_stderr_logger();

    let stdout_guard: Arc<StdoutLock> = Arc::new(Mutex::new(()));
    let (tx, rx) = mpsc::channel::<Value>();

    // stdin 读取线程：只做解析与投递
    std::thread::spawn(move || {
        for line in BufReader::new(std::io::stdin())
            .lines()
            .map_while(Result::ok)
        {
            if line.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<Value>(&line) {
                Ok(msg) => {
                    if tx.send(msg).is_err() {
                        // 主循环已退出：读取使命结束
                        return;
                    }
                }
                Err(e) => {
                    log::warn!("vst-host: unparseable stdin line ({e}): {line}");
                }
            }
        }
        // stdin 关闭 = 主进程没了（或被 kill）：退出，避免孤儿进程
        std::process::exit(0);
    });

    // 管理器固定在主线程：`HWND` 与音频流句柄都是 `!Send`（见 host.rs 顶部说明）
    let mut mgr = VstManager::new();

    loop {
        // 泵编辑器窗口消息（仅 Windows）：缺这一步窗口会卡死（见 [`win_pump`]）。
        #[cfg(windows)]
        win_pump::pump();

        // 带超时收请求；空闲时醒来服务编辑器窗口
        let request = rx
            .recv_timeout(Duration::from_millis(EDITOR_SERVICE_INTERVAL_MS))
            .ok();
        if let Some(msg) = request {
            if handle_request(&mut mgr, &msg, &stdout_guard) == FlowControl::Shutdown {
                mgr.shutdown();
                return;
            }
        }

        // 编辑器窗口逐帧服务：处理 resize/DPI 请求与用户关窗
        if service_editor_once(&mut mgr) {
            send_event(&stdout_guard, "snapshot", &snapshot_value(&mgr));
        }

        // 再次泵：确保命令处理期间（如刚 open_editor 创建窗口后）产生的消息也被分派
        #[cfg(windows)]
        win_pump::pump();
    }
}

#[derive(PartialEq)]
enum FlowControl {
    Continue,
    Shutdown,
}

/// 处理一条请求；需要应答的命令写回带 id 的响应，`send_midi` 与事件无应答。
fn handle_request(mgr: &mut VstManager, msg: &Value, stdout: &Arc<StdoutLock>) -> FlowControl {
    let cmd = msg.get("cmd").and_then(Value::as_str).unwrap_or("");
    let id = msg.get("id").and_then(Value::as_u64);

    let result: Result<Value, String> = match cmd {
        "load" => {
            let path = msg
                .get("path")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let open_editor = msg
                .get("openEditor")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            mgr.load(&path, open_editor).map(|_| Value::Null)
        }
        "unload" => {
            mgr.unload();
            Ok(Value::Null)
        }
        "open_editor" => mgr.open_editor().map(|_| Value::Null),
        "close_editor" => mgr.close_editor().map(|_| Value::Null),
        "send_midi" => {
            // fire-and-forget：主进程不等响应
            if let Some(bytes) = msg.get("bytes").and_then(Value::as_array) {
                let bytes: Vec<u8> = bytes
                    .iter()
                    .filter_map(Value::as_u64)
                    .map(|b| b as u8)
                    .collect();
                if let Err(e) = mgr.send_midi(&bytes) {
                    log::debug!("vst-host: send_midi failed: {e}");
                }
            }
            return FlowControl::Continue;
        }
        "snapshot" => Ok(snapshot_value(mgr)),
        "scan" => {
            let paths: Vec<PathBuf> = msg
                .get("paths")
                .and_then(Value::as_array)
                .map(|arr| {
                    arr.iter()
                        .filter_map(Value::as_str)
                        .map(PathBuf::from)
                        .collect()
                })
                .unwrap_or_default();
            // 扫描是长活（逐插件 dlopen + 实例化，插件多时分钟级），放到后台线程：
            // 主循环继续处理 MIDI / load / 编辑器服务，扫描期间宿主保持响应；
            // 也消除启动期 scan 与 load 排队竞速导致请求超时（表现为"扫描不到
            // 插件但状态可用"）。内省不触碰 `mgr`（纯 vst3_host 调用），线程安全。
            // 单个坏插件 abort 仍会带走子进程，由主进程崩溃检测兜底。
            let stdout = std::sync::Arc::clone(stdout);
            log::info!("vst-host: scan started ({} paths, background thread)", paths.len());
            std::thread::spawn(move || {
                let result = serde_json::to_value(introspect_plugins(&paths))
                    .map_err(|e| format!("serialize scan result: {e}"));
                respond(&stdout, id, result);
                log::info!("vst-host: scan finished");
            });
            return FlowControl::Continue;
        }
        "shutdown" => {
            respond(stdout, id, Ok(Value::Null));
            return FlowControl::Shutdown;
        }
        other => Err(format!("unknown command '{other}'")),
    };

    respond(stdout, id, result);

    // 状态可能被 load/unload/editor 改变：推送最新快照（含 status 事件）
    send_event(stdout, "snapshot", &snapshot_value(mgr));

    FlowControl::Continue
}

/// 当前快照（与主进程 `get_vst_status` 的返回同形）。
fn snapshot_value(mgr: &VstManager) -> Value {
    json!({
        "status": mgr.status().to_payload(),
        "plugin": mgr.current_info(),
    })
}

/// 写一行响应。id 为 `None`（不该发生）时跳过——响应必须有 id 才能被路由。
fn respond(stdout: &Arc<StdoutLock>, id: Option<u64>, result: Result<Value, String>) {
    let Some(id) = id else {
        log::warn!("vst-host: response without request id dropped");
        return;
    };
    let line = match result {
        Ok(value) => json!({ "id": id, "ok": true, "result": value }),
        Err(error) => json!({ "id": id, "ok": false, "error": error }),
    };
    let _guard = stdout.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let _ = writeln!(std::io::stdout(), "{line}");
    let _ = std::io::stdout().flush();
}

/// 写一行事件（无 id）。
fn send_event(stdout: &Arc<StdoutLock>, event: &str, payload: &Value) {
    let line = json!({ "event": event, "payload": payload });
    let _guard = stdout.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let _ = writeln!(std::io::stdout(), "{line}");
    let _ = std::io::stdout().flush();
}

/// 极简 stderr 日志器：主进程会把 stderr 桥接到自己的日志里。
fn init_stderr_logger() {
    struct StderrLogger;
    impl log::Log for StderrLogger {
        fn enabled(&self, metadata: &log::Metadata) -> bool {
            metadata.level() <= log::Level::Info
        }
        fn log(&self, record: &log::Record) {
            if self.enabled(record.metadata()) {
                eprintln!("[{}] {}", record.level(), record.args());
            }
        }
        fn flush(&self) {}
    }
    // 用 `set_logger`（`&'static Log`）而非 `set_boxed_logger`：后者需要 log 的
    // `alloc` feature（0.4.34 起默认 feature 已移除，显式启用会牵动依赖统一）。
    static LOGGER: StderrLogger = StderrLogger;
    let _ = log::set_logger(&LOGGER);
    log::set_max_level(log::LevelFilter::Info);
}
