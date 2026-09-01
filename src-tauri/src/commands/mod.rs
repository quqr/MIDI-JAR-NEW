//! Tauri 命令层：按领域分组组织全部 `#[tauri::command]`，统一再导出。

pub mod app;
pub mod dialog;
pub mod fs;
pub mod midi;
pub mod widget;

pub use app::*;
pub use dialog::*;
pub use fs::*;
pub use midi::*;
pub use widget::*;
