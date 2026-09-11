//! VST3 插件扫描与扫描结果缓存。
//!
//! 扫描分两半（ADR 0022 进程隔离）：
//! - **目录枚举**（纯文件系统，无崩溃风险）在主进程：[`effective_scan_paths`]；
//! - **逐插件内省**（加载 DLL，可能被坏插件崩掉）在 `vst-host` 子进程：
//!   [`introspect_plugins`]，由主进程经 [`super::bridge`] 转发。
//!
//! [`scan_plugins`] 的**错误语义保持不变**——依然返回带 `error` 字段的报告，
//! 前端据此区分"扫了但没有插件"与"扫描根本没跑起来"。

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

/// 单个插件的扫描结果（面向前端的扁平结构）。
///
/// 只保留界面上真正要用的字段：`vst3-host` 的 [`vst3_host::DetailedPluginInfo`] 很深
/// （包含全部 class、全部 bus、moduleinfo），直接丢给前端既冗长又有多处版本耦合。
/// `Deserialize` 供 bridge 从子进程的 scan 响应反序列化（扫描内省在子进程执行）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedPlugin {
    /// `.vst3` bundle 的绝对路径，同时作为实例的唯一标识。
    pub path: String,
    /// 展示名（无 `moduleinfo` 时由工厂类名兜底，再兜底文件名）。
    pub name: String,
    /// 厂商名。
    pub vendor: String,
    /// 版本字符串，可能为空。
    pub version: String,
    /// 子类别，如 `Instrument|Synth`。
    pub category: String,
    /// VST3 class uid（32 位 hex）。
    pub uid: String,
    /// 音频输入总线数。
    pub audio_inputs: u32,
    /// 音频输出总线数。
    pub audio_outputs: u32,
    /// 是否有事件（MIDI）输入总线——本应用的音源必须是 `true`。
    pub has_midi_input: bool,
    /// 是否有事件（MIDI）输出总线。
    pub has_midi_output: bool,
    /// 是否提供编辑器（edit controller 存在）。
    pub has_gui: bool,
}

/// 被跳过的插件及其原因。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedPlugin {
    /// 插件路径。
    pub path: String,
    /// 机器可读的原因分类：`failed` / `crashed` / `timedOut`。
    ///
    /// in-process 扫描下只会产生 `failed`（内省返回 `Err`）；`crashed` / `timedOut`
    /// 是探针时代的分类，保留枚举值仅为兼容前端已落的 i18n 文案与历史缓存。
    pub reason: String,
    /// 人类可读的补充说明（错误详情等）。
    pub detail: Option<String>,
}

/// 一次完整扫描的产物。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCache {
    /// 本次扫描实际使用的目录列表（标准目录 + 用户自定义目录，去重后）。
    pub paths: Vec<String>,
    /// 扫描成功的插件。
    pub plugins: Vec<ScannedPlugin>,
    /// 被跳过的插件。
    pub skipped: Vec<SkippedPlugin>,
    /// 扫描没能跑起来时的原因（探针二进制缺失等）。`Some` 时 `plugins` 必然为空，
    /// 且不能向用户展示为"没有装插件"。
    pub error: Option<String>,
    /// 扫描完成的 Unix 毫秒时间戳。
    pub scanned_at: u64,
}

/// 全局扫描缓存。
///
/// 用 `Mutex` 而不是 `RwLock`：读写的临界区都极短（克隆一个结构体 / 换一个 `Option`），
/// 且没有高并发读的场景。
static SCAN_CACHE: Mutex<Option<ScanCache>> = Mutex::new(None);

/// 用户自定义的额外扫描目录。
static EXTRA_PATHS: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// 把 `PathBuf` 转成面向前端的字符串，非 UTF-8 路径做有损转换（Windows 上极少见，
/// 但不如直接丢掉这个插件）。
fn path_string(path: &std::path::Path) -> String {
    path.to_string_lossy().into_owned()
}

/// 当前 Unix 毫秒时间戳。
fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 把 crate 的详细内省结果压成前端需要的扁平结构。
fn to_scanned_plugin(info: &vst3_host::DetailedPluginInfo) -> ScannedPlugin {
    ScannedPlugin {
        path: path_string(&info.info.path),
        name: info.info.name.clone(),
        vendor: if info.factory.vendor.is_empty() {
            info.info.vendor.clone()
        } else {
            info.factory.vendor.clone()
        },
        version: info.info.version.clone(),
        category: info.info.category.clone(),
        uid: info.info.uid.clone(),
        audio_inputs: info.info.audio_inputs,
        audio_outputs: info.info.audio_outputs,
        has_midi_input: info.info.has_midi_input,
        has_midi_output: info.info.has_midi_output,
        has_gui: info.info.has_gui,
    }
}

/// 当前生效的扫描目录集合 = 标准目录 + 用户自定义目录，保持顺序并去重。
///
/// 去重按字符串比较（不做 canonicalize）：既避免一次磁盘往返，也避免目录不存在时
/// canonicalize 失败导致路径被静默丢弃。
pub fn effective_scan_paths() -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = vst3_host::discovery::scan_standard_paths();

    if let Ok(extra) = EXTRA_PATHS.lock() {
        for path in extra.iter() {
            paths.push(PathBuf::from(path));
        }
    }

    let mut seen = std::collections::HashSet::new();
    paths.retain(|path| seen.insert(path_string(path)));
    paths
}

/// 对给定目录列表执行逐插件内省，返回扫描报告。
///
/// **本函数加载 DLL，运行在 vst-host 子进程里**（ADR 0022）——坏插件崩溃只带走
/// 子进程。只做内省，不枚举目录、不写缓存；单个插件失败记为 `skipped` 并继续。
/// 子进程不直接访问 `EXTRA_PATHS`，目录列表由主进程传入。
pub fn introspect_plugins(paths: &[PathBuf]) -> ScanCache {
    let mut plugins = Vec::new();
    let mut skipped = Vec::new();

    for path in paths {
        match vst3_host::get_detailed_plugin_info(path) {
            Ok(info) => plugins.push(to_scanned_plugin(&info)),
            Err(e) => {
                // 内省失败：插件本身有问题（缺 factory、模块加载失败、元数据非法……）。
                // 记下来继续扫下一个——单个坏插件不该让整轮白跑。
                let detail = e.to_string();
                log::warn!("Skipping plugin {}: {detail}", path.display());
                skipped.push(SkippedPlugin {
                    path: path_string(path),
                    reason: "failed".to_string(),
                    detail: Some(detail),
                });
            }
        }
    }

    ScanCache {
        paths: paths.iter().map(|p| path_string(p)).collect(),
        plugins,
        skipped,
        error: None,
        scanned_at: now_millis(),
    }
}

/// 执行一次全量扫描，并把结果写入缓存（**主进程侧**）。
///
/// 流程：枚举目录（主进程）→ 经 bridge 把目录列表交给子进程内省 → 写缓存。
/// 子进程不可用（启动失败/崩溃后重启失败）时，返回带 `error` 的空报告——
/// 与"目录枚举失败"同一错误通道，前端渲染明确的错误态。
pub fn scan_plugins() -> ScanCache {
    let paths = effective_scan_paths();

    // 目录枚举是纯文件系统操作（找 .vst3 bundle），不加载 DLL，留在主进程安全。
    let (plugin_paths, error) = match vst3_host::discovery::scan_directories(&paths) {
        Ok(found) => (found, None),
        Err(e) => {
            let message = format!("failed to enumerate plugins: {e}");
            log::warn!("VST scan could not enumerate directories: {message}");
            (Vec::new(), Some(message))
        }
    };

    // DLL 内省交给子进程（坏插件崩溃只带走子进程）。
    let mut cache = match super::bridge::introspect(
        plugin_paths.iter().map(|p| path_string(p)).collect(),
    ) {
        Ok(mut c) => {
            c.paths = paths.iter().map(|p| path_string(p)).collect();
            c.error = error;
            c
        }
        Err(e) => {
            log::warn!("VST scan could not reach vst-host process: {e}");
            ScanCache {
                paths: paths.iter().map(|p| path_string(p)).collect(),
                plugins: Vec::new(),
                skipped: Vec::new(),
                error: Some(format!("vst host process unavailable: {e}")),
                scanned_at: now_millis(),
            }
        }
    };
    cache.scanned_at = now_millis();

    if let Ok(mut guard) = SCAN_CACHE.lock() {
        *guard = Some(cache.clone());
    }

    cache
}

/// 读取缓存的扫描结果。未扫描过时为 `None`。
pub fn cached_scan() -> Option<ScanCache> {
    SCAN_CACHE.lock().ok().and_then(|guard| guard.clone())
}

/// 添加一个用户自定义扫描目录。
///
/// 返回添加后的完整目录列表。重复添加同一个目录会被忽略（幂等）。
pub fn add_scan_path(path: String) -> Vec<String> {
    if let Ok(mut extra) = EXTRA_PATHS.lock() {
        if !extra.iter().any(|existing| existing == &path) {
            extra.push(path);
        }
    }
    effective_scan_paths()
        .iter()
        .map(|p| path_string(p))
        .collect()
}

/// 移除一个用户自定义扫描目录。
///
/// 只能移除自定义目录——标准目录不在 `EXTRA_PATHS` 里，移除请求会被静默忽略。
/// 返回移除后的完整目录列表。
pub fn remove_scan_path(path: &str) -> Vec<String> {
    if let Ok(mut extra) = EXTRA_PATHS.lock() {
        extra.retain(|existing| existing != path);
    }
    effective_scan_paths()
        .iter()
        .map(|p| path_string(p))
        .collect()
}

/// 用前端持久化的自定义目录初始化模块状态（启动时调用一次）。
pub fn restore_extra_paths(paths: Vec<String>) {
    if let Ok(mut extra) = EXTRA_PATHS.lock() {
        *extra = paths;
    }
}
