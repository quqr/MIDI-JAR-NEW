//! VST3 插件扫描与扫描结果缓存。
//!
//! 扫描走注入式 in-process 内省（[`vst3_host::get_detailed_plugin_info`]）：**逐插件**
//! 读取元数据，单个插件内省失败只记为 `skipped`，不会中断整轮扫描。
//!
//! # 为什么不用 `discover_plugins_safe`（探针子进程）
//!
//! crate 提供的"安全扫描"要把每个插件放到独立子进程里内省，靠子进程崩溃来隔离坏插件。
//! 本项目**放弃了这条路**：
//!
//! 1. 探针二进制属于 `vst3-host` 这个**依赖**的 `[[bin]]` 目标，Cargo 不会为上层包
//!    构建它 → 必须手动/脚本单独构建并随包分发，对任何新机器都是隐形成本；
//! 2. 隔离只能覆盖扫描阶段，而**真正危险的时刻是加载/运行**，那一侧在 Windows 上
//!    无法做进程隔离（跨进程编辑器桥接只在 macOS 实现）。隔离做一半，收益有限却
//!    带来实打实的构建与分发负担。
//!
//! 因此扫描与加载统一为 in-process + 显式错误态：崩溃风险由 UI 明示（见 README）。
//! [`scan_plugins`] 的 **错误语义保持不变**——它依然返回带 `error` 字段的报告，
//! 前端据此区分"扫了但没有插件"与"扫描根本没跑起来"，只是现在 `error` 只会来自
//! 目录枚举失败（例如标准目录不可读），不再来自"探针缺失"。

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

/// 单个插件的扫描结果（面向前端的扁平结构）。
///
/// 只保留界面上真正要用的字段：`vst3-host` 的 [`vst3_host::DetailedPluginInfo`] 很深
/// （包含全部 class、全部 bus、moduleinfo），直接丢给前端既冗长又有多处版本耦合。
#[derive(Debug, Clone, Serialize)]
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
#[derive(Debug, Clone, Serialize)]
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
#[derive(Debug, Clone, Serialize)]
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

/// 执行一次全量扫描，并把结果写入缓存。
///
/// 流程：枚举目录 → 逐插件 in-process 内省 → 成功的进 `plugins`，失败进 `skipped`。
/// 单个插件的失败**不会**中断整轮扫描；只有"目录枚举失败"这类致命问题才写 `error`。
///
/// 无论扫描是否成功都会写缓存：失败时缓存里 `error` 为 `Some`，前端据此渲染明确的错误态
/// 而不是"未发现插件"。
pub fn scan_plugins() -> ScanCache {
    let paths = effective_scan_paths();

    let (plugin_paths, error) = match vst3_host::discovery::scan_directories(&paths) {
        Ok(found) => (found, None),
        Err(e) => {
            let message = format!("failed to enumerate plugins: {e}");
            log::warn!("VST scan could not enumerate directories: {message}");
            (Vec::new(), Some(message))
        }
    };

    let mut plugins = Vec::new();
    let mut skipped = Vec::new();

    for path in plugin_paths {
        match vst3_host::get_detailed_plugin_info(&path) {
            Ok(info) => plugins.push(to_scanned_plugin(&info)),
            Err(e) => {
                // in-process 内省失败：插件本身有问题（缺 factory、模块加载失败、
                // 元数据非法……）。记下来继续扫下一个——单个坏插件不该让整轮白跑。
                let detail = e.to_string();
                log::warn!("Skipping plugin {}: {detail}", path.display());
                skipped.push(SkippedPlugin {
                    path: path_string(&path),
                    reason: "failed".to_string(),
                    detail: Some(detail),
                });
            }
        }
    }

    let cache = ScanCache {
        paths: paths.iter().map(|p| path_string(p)).collect(),
        plugins,
        skipped,
        error,
        scanned_at: now_millis(),
    };

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
