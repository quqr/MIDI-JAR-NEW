mod midi;
mod tauri_log_sink;

use midi::MidiManager;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};

const WINDOW_STATE_FILE: &str = "app-data/window-state.json";
const DEFAULT_WIDTH: f64 = 1200.0;
const DEFAULT_HEIGHT: f64 = 800.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub is_maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: None,
            y: None,
            width: Some(DEFAULT_WIDTH),
            height: Some(DEFAULT_HEIGHT),
            is_maximized: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidgetWindowState {
    pub id: String,
    pub widget_type: String,
    pub module_id: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub is_maximized: bool,
    pub opacity: f64,
    pub always_on_top: bool,
    pub auto_hide: bool,
    pub position_locked: bool,
}

const WIDGET_STATE_FILE: &str = "app-data/widget-state.json";

struct AppState {
    midi: Mutex<MidiManager>,
}

fn get_window_state_path(app: &AppHandle) -> PathBuf {
    let app_data_dir = app.path().app_data_dir().expect("failed to resolve app data dir");
    let app_data = app_data_dir.join("app-data");
    let _ = fs::create_dir_all(&app_data);
    app_data.join(WINDOW_STATE_FILE)
}

fn load_window_state(app: &AppHandle) -> WindowState {
    let path = get_window_state_path(app);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(state) = serde_json::from_str(&content) {
                return state;
            }
        }
    }
    WindowState::default()
}

fn save_window_state(app: &AppHandle, state: &WindowState) {
    let path = get_window_state_path(app);
    if let Ok(content) = serde_json::to_string_pretty(state) {
        let _ = fs::write(path, content);
    }
}

fn get_widget_state_path(app: &AppHandle) -> PathBuf {
    let app_data_dir = app.path().app_data_dir().expect("failed to resolve app data dir");
    let app_data = app_data_dir.join("app-data");
    let _ = fs::create_dir_all(&app_data);
    app_data.join(WIDGET_STATE_FILE)
}

fn load_widget_states(app: &AppHandle) -> Vec<WidgetWindowState> {
    let path = get_widget_state_path(app);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(states) = serde_json::from_str(&content) {
                return states;
            }
        }
    }
    Vec::new()
}

fn save_widget_states(app: &AppHandle, states: &[WidgetWindowState]) {
    let path = get_widget_state_path(app);
    if let Ok(content) = serde_json::to_string_pretty(states) {
        let _ = fs::write(path, content);
    }
}

#[tauri::command]
fn get_app_version(app: AppHandle) -> String {
    app.config().version.clone().unwrap_or_default()
}

#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
fn is_maximized(window: tauri::WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_window_state(app: AppHandle) -> WindowState {
    load_window_state(&app)
}

#[tauri::command]
fn set_always_on_top(window: tauri::WebviewWindow, flag: bool) -> Result<bool, String> {
    window.set_always_on_top(flag).map_err(|e| e.to_string())?;
    Ok(window.is_always_on_top().unwrap_or(false))
}

#[tauri::command]
async fn open_file_dialog(
    app: AppHandle,
) -> Result<Option<Vec<String>>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().add_filter("MIDI Files", &["mid", "midi"]).add_filter("All Files", &["*"]).pick_files(move |paths| {
        let _ = tx.send(paths);
    });
    let result = rx.recv().map_err(|_| "dialog cancelled".to_string())?;
    Ok(result.map(|paths| paths.iter().map(|p| p.to_string()).collect()))
}

#[tauri::command]
async fn save_file_dialog(
    app: AppHandle,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().add_filter("MIDI Files", &["mid", "midi"]).set_file_name("untitled.mid").pick_file(move |path| {
        let _ = tx.send(path);
    });
    let result = rx.recv().map_err(|_| "dialog cancelled".to_string())?;
    Ok(result.map(|p| p.to_string()))
}

#[tauri::command]
fn read_file(file_path: String, app: AppHandle) -> Result<String, String> {
    let allowed_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let resolved = std::path::Path::new(&file_path)
        .canonicalize()
        .map_err(|e| format!("invalid path: {}", e))?;
    if !resolved.starts_with(&allowed_dir) {
        return Err("access denied: path outside app data directory".into());
    }
    fs::read_to_string(&resolved).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(file_path: String, content: String, app: AppHandle) -> Result<(), String> {
    let allowed_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let resolved = std::path::Path::new(&file_path)
        .canonicalize()
        .map_err(|e| format!("invalid path: {}", e))?;
    if !resolved.starts_with(&allowed_dir) {
        return Err("access denied: path outside app data directory".into());
    }
    fs::write(&resolved, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_external(url: String, app: AppHandle) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("access denied: only http:// and https:// URLs are allowed".into());
    }
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(url, None::<String>).map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_widget_window(
    app: AppHandle,
    label: String,
    title: String,
    url: String,
    width: f64,
    height: f64,
    x: f64,
    y: f64,
    always_on_top: bool,
) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;

    let existing = app.get_webview_window(&label);
    if existing.is_some() {
        let win = existing.unwrap();
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(&title)
        .inner_size(width, height)
        .position(x, y)
        .always_on_top(always_on_top)
        .decorations(false)
        .resizable(true)
        .min_inner_size(200.0, 150.0)
        .shadow(false)
        .visible(true);

    let win = builder.build().map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    let label_clone = label.clone();
    win.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { .. } = event {
            let _ = app_handle.emit("widget:closed", &label_clone);
        }
    });

    Ok(())
}

#[tauri::command]
fn close_widget_window(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&label) {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_widget_states(app: AppHandle) -> Vec<WidgetWindowState> {
    load_widget_states(&app)
}

#[tauri::command]
fn save_widget_states_cmd(app: AppHandle, states: Vec<WidgetWindowState>) {
    save_widget_states(&app, &states);
}

#[tauri::command]
fn get_all_widget_windows(app: AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .filter(|k| k.starts_with("widget-"))
        .cloned()
        .collect()
}

#[tauri::command]
fn refresh_devices(app: AppHandle) {
    let state = app.state::<AppState>();
    let mut midi = state.midi.lock().unwrap();
    midi.refresh_devices(&app, true);
}

#[tauri::command]
fn clear_routes(app: AppHandle) {
    let state = app.state::<AppState>();
    let mut midi = state.midi.lock().unwrap();
    midi.clear_routes(&app);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MidiRouteRaw {
    pub input: String,
    pub output: String,
    #[serde(rename = "type")]
    pub route_type: String,
    pub enabled: bool,
}

#[tauri::command]
fn add_route(app: AppHandle, route: MidiRouteRaw) {
    let state = app.state::<AppState>();
    let mut midi = state.midi.lock().unwrap();
    midi.add_route(&app, route);
}

#[tauri::command]
fn delete_route(app: AppHandle, route: MidiRouteRaw) {
    let state = app.state::<AppState>();
    let mut midi = state.midi.lock().unwrap();
    midi.delete_route(&app, route);
}

#[tauri::command]
fn sync_routes(app: AppHandle, routes: Vec<MidiRouteRaw>) {
    let state = app.state::<AppState>();
    let mut midi = state.midi.lock().unwrap();
    midi.sync_routes(&app, routes);
}

#[tauri::command]
fn get_inputs(app: AppHandle) -> Vec<midi::ApiMidiInput> {
    let state = app.state::<AppState>();
    let midi = state.midi.lock().unwrap();
    midi.get_inputs()
}

#[tauri::command]
fn get_outputs(app: AppHandle) -> Vec<midi::ApiMidiOutput> {
    let state = app.state::<AppState>();
    let midi = state.midi.lock().unwrap();
    midi.get_outputs()
}

#[tauri::command]
fn get_wires(app: AppHandle) -> Vec<midi::ApiMidiWire> {
    let state = app.state::<AppState>();
    let midi = state.midi.lock().unwrap();
    midi.get_wires()
}

// ===== Virtual Port Commands =====

#[tauri::command]
fn is_virtual_port_supported() -> bool {
    MidiManager::is_virtual_port_supported()
}

#[tauri::command]
fn create_virtual_input(app: AppHandle, name: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut midi = state.midi.lock().unwrap();
    midi.create_virtual_input(&app, &name)
}

#[tauri::command]
fn create_virtual_output(app: AppHandle, name: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut midi = state.midi.lock().unwrap();
    midi.create_virtual_output(&app, &name)
}

#[tauri::command]
fn delete_virtual_input(app: AppHandle, name: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut midi = state.midi.lock().unwrap();
    midi.delete_virtual_input(&app, &name)
}

#[tauri::command]
fn delete_virtual_output(app: AppHandle, name: String) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut midi = state.midi.lock().unwrap();
    midi.delete_virtual_output(&app, &name)
}

#[tauri::command]
fn get_virtual_inputs(app: AppHandle) -> Vec<String> {
    let state = app.state::<AppState>();
    let midi = state.midi.lock().unwrap();
    midi.get_virtual_inputs()
}

#[tauri::command]
fn get_virtual_outputs(app: AppHandle) -> Vec<String> {
    let state = app.state::<AppState>();
    let midi = state.midi.lock().unwrap();
    midi.get_virtual_outputs()
}

pub fn run() {
    // 初始化 Tauri 自定义 logger（替代 env_logger）
    // 同时输出到控制台和前端 Debugger 页面
    tauri_log_sink::init_logger();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // 设置 AppHandle 到 logger，使其能够发送日志到前端
            tauri_log_sink::set_app_handle(std::sync::Arc::new(app_handle.clone()));

            let midi_manager = MidiManager::new(app_handle.clone());

            app.manage(AppState {
                midi: Mutex::new(midi_manager),
            });

            let window = app.get_webview_window("main").expect("no main window");

            // 所有平台统一使用无边框窗口，由前端自定义导航栏
            {
                let _ = window.set_decorations(false);
            }

            // 开发模式下，若 Vite 因端口被占用而自动切换到其他端口，
            // 读取 src-tauri/dev-server-port 并把主窗口重定向到真实端口。
            // 该文件由 Vite 的 write-resolved-dev-port 插件在 server listening
            // 后写入，可能晚于本 setup 钩子执行，因此用一个后台线程轮询，
            // 既避免读到上一次运行的旧值，也避免阻塞窗口创建。
            #[cfg(debug_assertions)]
            {
                // tauri.conf.json 中的 devUrl 端口，作为“未切换”基准。
                const CONFIGURED_PORT: u16 = 5173;

                if let Ok(cwd) = std::env::current_dir() {
                    let port_path = cwd.join("src-tauri").join("dev-server-port");
                    let win = window.clone();
                    std::thread::spawn(move || {
                        // 最多轮询 10 秒（100 * 100ms）
                        for _ in 0..100 {
                            if let Ok(s) = fs::read_to_string(&port_path) {
                                if let Ok(port) = s.trim().parse::<u16>() {
                                    // 仅在 Vite 实际切换到非默认端口时才重定向
                                    if port != CONFIGURED_PORT {
                                        if let Ok(url) = tauri::Url::parse(
                                            &format!("http://localhost:{port}"),
                                        ) {
                                            let _ = win.navigate(url);
                                        }
                                    }
                                    break;
                                }
                            }
                            std::thread::sleep(std::time::Duration::from_millis(100));
                        }
                    });
                }
            }

            let app_handle_clone = app_handle.clone();
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::Resized(_) => {
                        let is_max = window_clone.is_maximized().unwrap_or(false);
                        let state = get_current_window_state(&window_clone);
                        save_window_state(&app_handle_clone, &state);
                        let _ = app_handle_clone.emit("window:on-maximized-changed", is_max);
                    }
                    WindowEvent::Moved(_) => {
                        let state = get_current_window_state(&window_clone);
                        save_window_state(&app_handle_clone, &state);
                    }
                    _ => {}
                }
            });

            let saved_state = load_window_state(&app_handle);
            if saved_state.is_maximized {
                let _ = window.maximize();
            }

            let _ = app_handle.emit("app:on-ready", ());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_platform,
            is_maximized,
            get_window_state,
            set_always_on_top,
            open_file_dialog,
            save_file_dialog,
            read_file,
            write_file,
            open_external,
            create_widget_window,
            close_widget_window,
            get_widget_states,
            save_widget_states_cmd,
            get_all_widget_windows,
            refresh_devices,
            clear_routes,
            add_route,
            delete_route,
            sync_routes,
            get_inputs,
            get_outputs,
            get_wires,
            is_virtual_port_supported,
            create_virtual_input,
            create_virtual_output,
            delete_virtual_input,
            delete_virtual_output,
            get_virtual_inputs,
            get_virtual_outputs,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<AppState>();
                let mut midi = state.midi.lock().unwrap();
                midi.stop_refresh_loop();
                let _ = app_handle.emit("app:on-before-quit", ());
            }
        });
}

fn get_current_window_state(window: &tauri::WebviewWindow) -> WindowState {
    let position = window.outer_position().ok();
    let size = window.inner_size().ok();
    let is_max = window.is_maximized().unwrap_or(false);

    WindowState {
        x: position.map(|p| p.x as f64),
        y: position.map(|p| p.y as f64),
        width: size.map(|s| s.width as f64),
        height: size.map(|s| s.height as f64),
        is_maximized: is_max,
    }
}
