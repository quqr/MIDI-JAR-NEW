use log::{Level, LevelFilter, Metadata, Record};
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

/// Tauri log sink - 将 Rust 日志同时输出到控制台和前端
///
/// 功能：
/// 1. 输出到控制台（带颜色）
/// 2. 通过 Tauri 事件发送到前端 Debugger 页面
pub struct TauriLogSink {
    app_handle: Option<Arc<AppHandle>>,
}

impl TauriLogSink {
    pub fn new() -> Self {
        Self { app_handle: None }
    }

    pub fn set_app_handle(&mut self, app_handle: Arc<AppHandle>) {
        self.app_handle = Some(app_handle);
    }
}

impl log::Log for TauriLogSink {
    fn enabled(&self, metadata: &Metadata) -> bool {
        // 根据环境决定日志级别
        let level = if cfg!(debug_assertions) {
            LevelFilter::Debug
        } else {
            LevelFilter::Warn
        };

        metadata.level() <= level
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }

        // 1. 输出到控制台（带颜色）
        self.log_to_console(record);

        // 2. 发送到前端（仅 Tauri 环境）
        if let Some(app_handle) = &self.app_handle {
            self.log_to_frontend(record, app_handle);
        }
    }

    fn flush(&self) {
        // 刷新标准错误输出
        let _ = std::io::stderr().flush();
    }
}

impl TauriLogSink {
    /// 输出到控制台（带颜色）
    fn log_to_console(&self, record: &Record) {
        let level = record.level();
        let args = record.args();

        // ANSI 颜色代码
        let color = match level {
            Level::Error => "\x1b[31m",   // 红色
            Level::Warn => "\x1b[33m",    // 黄色
            Level::Info => "\x1b[32m",    // 绿色
            Level::Debug => "\x1b[36m",   // 青色
            Level::Trace => "\x1b[90m",   // 灰色
        };
        let reset = "\x1b[0m";

        // 格式化输出
        let module = record.module_path().unwrap_or("unknown");
        let file = record.file().unwrap_or("unknown");
        let line = record.line().unwrap_or(0);

        let output = if cfg!(debug_assertions) {
            // 开发环境：显示完整信息
            format!(
                "{}[{} {}:{}:{}]{} {}",
                color, level, module, file, line, reset, args
            )
        } else {
            // 生产环境：简化输出
            format!("{}[{}]{} {}", color, level, reset, args)
        };

        // 输出到标准错误
        let _ = writeln!(std::io::stderr(), "{}", output);
    }

    /// 发送到前端（通过 Tauri 事件）
    fn log_to_frontend(&self, record: &Record, app_handle: &AppHandle) {
        let log_data = serde_json::json!({
            "level": record.level().to_string(),
            "message": format!("{}", record.args()),
            "module": record.module_path().unwrap_or("unknown"),
        });

        // 发送到前端
        let _ = app_handle.emit("rust:log", log_data.to_string());
    }
}

/// Logger 包装类型，用于实现全局 logger
struct LoggerWrapper {
    inner: Mutex<TauriLogSink>,
}

impl log::Log for LoggerWrapper {
    fn enabled(&self, metadata: &Metadata) -> bool {
        self.inner.lock().unwrap().enabled(metadata)
    }

    fn log(&self, record: &Record) {
        self.inner.lock().unwrap().log(record);
    }

    fn flush(&self) {
        self.inner.lock().unwrap().flush();
    }
}

/// 全局 logger 实例
static LOGGER: once_cell::sync::Lazy<LoggerWrapper> =
    once_cell::sync::Lazy::new(|| LoggerWrapper {
        inner: Mutex::new(TauriLogSink::new()),
    });

/// 初始化 Tauri log sink
///
/// 设置为全局 logger，替代 env_logger
pub fn init_logger() {
    // 设置为全局 logger
    log::set_logger(&*LOGGER)
        .map(|()| {
            // 根据环境设置日志级别
            let level = if cfg!(debug_assertions) {
                LevelFilter::Debug
            } else {
                LevelFilter::Warn
            };
            log::set_max_level(level)
        })
        .expect("Failed to set Tauri log sink");
}

/// 设置 AppHandle（在 Tauri 初始化后调用）
pub fn set_app_handle(app_handle: Arc<AppHandle>) {
    LOGGER.inner.lock().unwrap().set_app_handle(app_handle);
}