//! 主进程侧的 vst-host 子进程桥（ADR 0022 进程隔离）。
//!
//! 职责：
//! - **子进程生命周期**：按需拉起（复用当前可执行文件 + `--vst-host` 参数，避免
//!   打包第二个二进制）、意外退出检测与状态兜底、应用退出时优雅关闭；
//! - **协议转发**：主进程命令 → stdio JSON-Lines 请求 → 子进程响应；
//! - **事件桥接**：子进程的 `status` / `snapshot` 事件 → Tauri `vst:status` 广播。
//!
//! # 协议（stdio JSON-Lines）
//!
//! 请求（主进程 → 子进程）：`{"id":N,"cmd":"load","path":"...","openEditor":true}`
//! 响应（子进程 → 主进程）：`{"id":N,"ok":true,"result":...}` / `{"id":N,"ok":false,"error":"..."}`
//! 事件（子进程 → 主进程，无 id）：`{"event":"status","payload":{...}}`、
//! `{"event":"snapshot","payload":{...}}`
//!
//! # Threading（本模块的关键不变量）
//!
//! **所有对子进程 stdin 的写入只发生在专职写线程里**；调用方（Tauri 命令、扫描
//! 线程）把 JSON 行送进无界通道即返回——绝不阻塞、绝不持 `BRIDGE` 锁做 I/O。
//! 历史教训：`send_vst_midi` 曾是同步命令（Tauri 2 中跑在主线程）且在调用线程
//! 直接 `write_all` + 按需拉起子进程，导致"按键触发 respawn + 5s 快照等待"
//! 的整界面卡死（bug #1/#3）；崩溃检测路径曾持 `BRIDGE` 锁 `wait()` 子进程，
//! 子进程不退出时所有后续请求永久死锁。本结构使这两类阻塞在协议层不可能发生。

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};

use super::scan::ScanCache;

/// 常规请求超时（unload / open_editor / close_editor / snapshot 等）。
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
/// 重活超时（load：含 dlopen、授权弹窗等待）。
const HEAVY_REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
/// 扫描超时：内省逐个加载 DLL 并实例化组件，插件多时总时长可达分钟级。
/// 给足余量，避免扫描被超时截断成"空结果 + 错误缓存"——那会让前端在插件
/// 实际存在时显示"扫描不到插件"，而持久化的加载路径照常工作（状态脱节）。
const SCAN_REQUEST_TIMEOUT: Duration = Duration::from_secs(120);
/// 退出时优雅关闭的等待上限；超时后强杀，避免编辑器浮窗残留。
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(2);
/// Windows `CREATE_NO_WINDOW`：子进程不弹控制台窗口。
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// 已派生的子进程桥。只保留进程句柄——stdin 由写线程独占，stdout 由读线程独占。
struct Bridge {
    child: Child,
}

/// 全局桥。`None` = 子进程未运行（首次使用或已崩溃，下次请求时重拉）。
static BRIDGE: Mutex<Option<Bridge>> = Mutex::new(None);
/// 命令写线程的入队端：发往子进程的每一行 JSON（请求 + MIDI）都经此投递。
/// `None` = 子进程未运行。
static CMD_TX: Mutex<Option<mpsc::Sender<String>>> = Mutex::new(None);
/// 请求 id 分配器。
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
/// 子进程拉起过程的串行化锁：并发首个请求只 spawn 一次。
static SPAWN_LOCK: Mutex<()> = Mutex::new(());
/// 等待中的请求：id → 结果投递端（读取线程收到带 id 的响应后送出）。
static PENDING: Mutex<Option<HashMap<u64, mpsc::SyncSender<Value>>>> = Mutex::new(None);
/// 最近一次快照（`get_vst_status` 的数据源，避免为读状态专门往返子进程）。
static SNAPSHOT: Mutex<Option<Value>> = Mutex::new(None);
/// 事件广播用的 AppHandle（`init` 时注册）。
static APP: OnceLock<AppHandle> = OnceLock::new();

/// 初始化事件广播通道。**必须在应用 setup 阶段调用一次。**
pub fn init(app: AppHandle) {
    let _ = APP.set(app);
    // 占位空快照：子进程未启动时 `get_vst_status` 也能返回一致的 empty 形状
    *snapshot_slot() = Some(json!({
        "status": { "state": "empty", "message": null },
        "plugin": null,
    }));
}

fn snapshot_slot() -> std::sync::MutexGuard<'static, Option<Value>> {
    SNAPSHOT
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// 当前状态快照（状态机 + 已加载插件信息），供 `get_vst_status` 返回。
pub fn snapshot() -> Value {
    snapshot_slot()
        .clone()
        .unwrap_or_else(|| json!({ "status": { "state": "empty", "message": null }, "plugin": null }))
}

/// 广播 `vst:status`（status 载荷变化时前端刷新）。
fn emit_status(status_payload: Value) {
    if let Some(app) = APP.get() {
        let _ = app.emit("vst:status", status_payload);
    }
}

/// 写一行 JSON 到子进程 stdin 并 flush（仅写线程调用——唯一写者，无需加锁）。
fn write_line(stdin: &mut std::process::ChildStdin, line: &str) -> Result<(), String> {
    stdin
        .write_all(line.as_bytes())
        .and_then(|_| stdin.write_all(b"\n"))
        .and_then(|_| stdin.flush())
        .map_err(|e| format!("vst-host stdin write failed: {e}"))
}

/// 确保子进程在运行；未运行（或刚崩溃）则重新拉起。
fn ensure_child() -> Result<(), String> {
    if BRIDGE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .is_some()
    {
        return Ok(());
    }

    // 串行化拉起：并发首次请求（如启动期 scan 与 load 竞速）只 spawn 一次。
    // 双重检查放在锁内，锁外先做无锁快路径。
    let _spawn_guard = SPAWN_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if BRIDGE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .is_some()
    {
        return Ok(());
    }

    let exe = std::env::current_exe().map_err(|e| format!("cannot locate current exe: {e}"))?;
    let mut cmd = Command::new(&exe);
    cmd.arg("--vst-host")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| format!("failed to spawn vst-host: {e}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "vst-host stdin unavailable".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "vst-host stdout unavailable".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "vst-host stderr unavailable".to_string())?;

    // stderr → 主进程日志桥接
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            log::info!(target: "vst-host", "{line}");
        }
    });

    // stdin 写线程：唯一写者。通道关闭（shutdown / 崩溃清理）或写失败（管道断裂，
    // 子进程已死）即退出。写阻塞只会阻塞本线程，调用方入队即返回。
    let (cmd_tx, cmd_rx) = mpsc::channel::<String>();
    std::thread::spawn(move || {
        let mut stdin = stdin;
        for line in cmd_rx.iter() {
            if write_line(&mut stdin, &line).is_err() {
                log::warn!("vst-host stdin writer stopped (pipe closed)");
                break;
            }
        }
    });

    // stdout 读取线程：响应路由 + 事件桥接 + 死亡检测
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let Ok(msg) = serde_json::from_str::<Value>(&line) else {
                log::warn!(target: "vst-host", "unparseable stdout line: {line}");
                continue;
            };

            if let Some(id) = msg.get("id").and_then(Value::as_u64) {
                // 响应：投递给等待者（等待者已超时消失则丢弃）
                if let Some(pending) = PENDING
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                    .as_mut()
                    .and_then(|map| map.remove(&id))
                {
                    let _ = pending.send(msg);
                }
            } else if let Some(event) = msg.get("event").and_then(Value::as_str) {
                match event {
                    "status" => {
                        if let Some(payload) = msg.get("payload") {
                            emit_status(payload.clone());
                        }
                    }
                    "snapshot" => {
                        if let Some(payload) = msg.get("payload") {
                            *snapshot_slot() = Some(payload.clone());
                            if let Some(status) = payload.get("status") {
                                emit_status(status.clone());
                            }
                        }
                    }
                    _ => {}
                }
            }
        }

        // stdout 结束 = 子进程已退出（正常 shutdown 也会走到这里；
        // 状态仍为 running 才视为意外崩溃）
        let crashed = {
            let mut slot = snapshot_slot();
            let was_running = slot
                .as_ref()
                .and_then(|s| s.get("status"))
                .and_then(|s| s.get("state"))
                .and_then(Value::as_str)
                .is_some_and(|state| state == "running");
            if was_running {
                *slot = Some(json!({
                    "status": {
                        "state": "error",
                        "message": "VST 插件进程已崩溃（vst-host exited unexpectedly）",
                    },
                    "plugin": null,
                }));
            }
            was_running
        };
        if crashed {
            log::warn!("vst-host process exited unexpectedly");
            if let Some(payload) = snapshot_slot()
                .as_ref()
                .and_then(|s| s.get("status"))
                .cloned()
            {
                emit_status(payload);
            }
        }

        // 快速失败：让所有等待中的请求立即收到错误，而不是干等各自超时。
        if let Some(map) = PENDING
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take()
        {
            for (_, pending) in map {
                let _ = pending.send(json!({
                    "ok": false,
                    "error": "vst-host process exited",
                }));
            }
        }
        // 撤掉写通道：入队端变 None，后续请求/MIDI 不再投递给死进程。
        *CMD_TX
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
        // 子进程句柄回收（reap）。**先交出锁再 wait**——wait 可能久等，
        // 持 BRIDGE 锪等待会让所有后续请求永久死锁（历史缺陷）。
        let bridge = BRIDGE
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take();
        if let Some(mut bridge) = bridge {
            let _ = bridge.child.wait();
        }
    });

    *BRIDGE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(Bridge { child });
    *CMD_TX
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(cmd_tx);

    // 子进程复活后本地缓存的"崩溃态"不再成立——拉取真实快照（失败不致命：
    // 下次前端 refreshStatus 会再取）。
    let _ = request("snapshot", json!({}), REQUEST_TIMEOUT);

    Ok(())
}

/// 发送一个请求并等待响应的 `result` 字段。
///
/// 写入只经无界通道入队（不阻塞、不持锁做 I/O）；阻塞仅发生在等待响应上，
/// 且有 `timeout` 上限。
fn request(cmd: &str, args: Value, timeout: Duration) -> Result<Value, String> {
    ensure_child()?;

    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);

    let mut msg = json!({ "id": id, "cmd": cmd });
    if let (Value::Object(dst), Value::Object(src)) = (&mut msg, args) {
        for (k, v) in src {
            dst.insert(k, v);
        }
    }
    let line = serde_json::to_string(&msg).map_err(|e| format!("serialize request: {e}"))?;

    let (tx, rx) = mpsc::sync_channel(1);
    PENDING
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .get_or_insert_with(HashMap::new)
        .insert(id, tx);

    let write_result = match CMD_TX
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .as_ref()
    {
        Some(sender) => sender
            .send(line)
            .map_err(|_| "vst-host command writer offline".to_string()),
        None => Err("vst-host not running".to_string()),
    };
    if let Err(e) = write_result {
        if let Some(map) = PENDING
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .as_mut()
        {
            map.remove(&id);
        }
        return Err(e);
    }

    let response = rx
        .recv_timeout(timeout)
        .map_err(|_| format!("vst-host did not answer '{cmd}' in time"))?;

    if response.get("ok").and_then(Value::as_bool) == Some(true) {
        Ok(response.get("result").cloned().unwrap_or(Value::Null))
    } else {
        Err(response
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("unknown vst-host error")
            .to_string())
    }
}

// ─── 面向命令层的转发 API ───

/// 加载插件（可选同时打开编辑器）并启动音频流。
pub fn load(path: String, open_editor: bool) -> Result<(), String> {
    request(
        "load",
        json!({ "path": path, "openEditor": open_editor }),
        HEAVY_REQUEST_TIMEOUT,
    )
    .map(|_| ())
}

/// 卸载当前插件。
///
/// 子进程没在跑 = 没有已加载插件，直接成功返回——**不**为一次卸载拉起整个
/// 子进程（切音源后的延迟卸载常落在子进程已退出的时刻）。
pub fn unload() -> Result<(), String> {
    let has_child = BRIDGE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .is_some();
    if !has_child {
        return Ok(());
    }
    request("unload", json!({}), REQUEST_TIMEOUT).map(|_| ())
}

/// 打开编辑器浮窗。
///
/// 子进程没在跑 = 没有已加载插件，直接报错返回——不为一次编辑器操作拉起子进程。
pub fn open_editor() -> Result<(), String> {
    let has_child = BRIDGE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .is_some();
    if !has_child {
        return Err("no plugin loaded".to_string());
    }
    request("open_editor", json!({}), REQUEST_TIMEOUT).map(|_| ())
}

/// 关闭编辑器浮窗（插件保活）。
pub fn close_editor() -> Result<(), String> {
    let has_child = BRIDGE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .is_some();
    if !has_child {
        return Err("no plugin loaded".to_string());
    }
    request("close_editor", json!({}), REQUEST_TIMEOUT).map(|_| ())
}

/// 投递原始 MIDI 字节（fire-and-forget：入队即返回，不等响应、绝不阻塞调用方）。
///
/// 刻意**不拉起**子进程：子进程没在跑意味着没有已加载插件，这条 MIDI 本来就
/// 无处可去——静默丢弃。旧实现在这里 ensure_child（spawn + 5s 快照等待），
/// 同步命令下直接卡死主线程（bug #1）。通道断开（子进程刚死）同样静默丢弃，
/// 由崩溃检测兜底状态显示。
pub fn send_midi(bytes: Vec<u8>) -> Result<(), String> {
    let line = serde_json::to_string(&json!({ "cmd": "send_midi", "bytes": bytes }))
        .map_err(|e| format!("serialize midi: {e}"))?;
    match CMD_TX
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .as_ref()
    {
        Some(sender) => sender
            .send(line)
            .map_err(|_| "vst-host midi writer offline".to_string()),
        None => Ok(()), // 子进程未运行：无插件可发声，静默丢弃
    }
}

/// 让子进程对给定插件路径列表做内省（扫描的 DLL 加载半场）。
pub fn introspect(paths: Vec<String>) -> Result<ScanCache, String> {
    let value = request("scan", json!({ "paths": paths }), SCAN_REQUEST_TIMEOUT)?;
    serde_json::from_value(value).map_err(|e| format!("invalid scan result: {e}"))
}

/// 应用退出前的优雅关闭：先请求，超时强杀。
///
/// 不经 [`ensure_child`]：子进程没在跑就无事可做，避免"退出时反而拉起子进程"。
pub fn shutdown() {
    let has_child = BRIDGE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .is_some();
    if has_child
        && let Err(e) = request("shutdown", json!({}), SHUTDOWN_TIMEOUT)
    {
        log::debug!("vst-host graceful shutdown failed ({e}); killing");
    }
    // 先撤写通道（写线程随后退出），再回收进程句柄。
    *CMD_TX
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
    if let Some(mut bridge) = BRIDGE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .take()
    {
        let _ = bridge.child.kill();
        let _ = bridge.child.wait();
    }
}
