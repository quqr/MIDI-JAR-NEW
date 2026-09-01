//! MIDI 子系统：设备发现/刷新、路由连线、虚拟端口与 [`MidiManager`] 对外 API。

mod device_manager;
mod input_device;
mod internal_output;
mod output_device;
mod route;
mod wire;

pub use input_device::ApiMidiInput;
pub use output_device::ApiMidiOutput;
pub use route::{MidiRoute, MidiRouteRaw};
pub use wire::ApiMidiWire;

use log::debug;
use device_manager::MidiDeviceManager as InnerManager;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

const REFRESH_LOOP_INTERVAL_MS: u64 = 1000;

pub struct MidiManager {
    manager: Arc<Mutex<InnerManager>>,
    routes: Vec<MidiRoute>,
    routes_shared: Arc<Mutex<Vec<MidiRoute>>>,
    refresh_handle: Option<std::thread::JoinHandle<()>>,
    refresh_running: Arc<Mutex<bool>>,
}

impl MidiManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let manager = Arc::new(Mutex::new(InnerManager::new()));

        let refresh_running = Arc::new(Mutex::new(true));
        let refresh_running_clone = refresh_running.clone();
        let manager_clone = manager.clone();
        let app_handle_clone = app_handle.clone();
        let routes_shared: Arc<Mutex<Vec<MidiRoute>>> = Arc::new(Mutex::new(Vec::new()));
        let routes_shared_clone = routes_shared.clone();

        let handle = std::thread::spawn(move || {
            loop {
                let running = {
                    let r = refresh_running_clone.lock().unwrap();
                    *r
                };
                if !running {
                    break;
                }

                // 锁内：仅刷新设备并在检测到变化时生成快照，缩短持锁时间
                let snapshot = {
                    let mut mgr = manager_clone.lock().unwrap();
                    mgr.refresh().then(|| (mgr.get_inputs(), mgr.get_outputs()))
                };
                if let Some((inputs, outputs)) = snapshot {
                    debug!("refresh loop: device change detected");
                    debug!("refresh loop: {} inputs, {} outputs", inputs.len(), outputs.len());
                    for inp in &inputs {
                        debug!("  input: '{}' connected={} opened={}", inp.name, inp.connected, inp.opened);
                    }
                    for out in &outputs {
                        debug!("  output: '{}' type='{}' connected={}", out.name, out.output_type, out.connected);
                    }

                    // emit 移至锁外执行，避免阻塞其他线程访问设备管理器
                    let _ = app_handle_clone.emit("midi:inputs", &inputs);
                    let _ = app_handle_clone.emit("midi:outputs", &outputs);

                    let pending_routes = routes_shared_clone.lock().unwrap().clone();
                    if !pending_routes.is_empty() {
                        debug!("refresh loop: re-applying {} routes", pending_routes.len());
                        // 短暂持锁完成路由重连，随后立即释放
                        let wires = {
                            let mut mgr = manager_clone.lock().unwrap();
                            mgr.route_midi(&pending_routes, &app_handle_clone);
                            mgr.get_wires()
                        };
                        debug!("refresh loop: emitting {} wires after reconnect", wires.len());
                        for w in &wires {
                            debug!("  wire: '{}' -> '{}' connected={}", w.route.input, w.route.output, w.connected);
                        }
                        let _ = app_handle_clone.emit("midi:wires", &wires);
                    }
                }

                std::thread::sleep(std::time::Duration::from_millis(REFRESH_LOOP_INTERVAL_MS));
            }
        });

        let mut mgr_instance = Self {
            manager,
            routes: Vec::new(),
            routes_shared,
            refresh_handle: Some(handle),
            refresh_running,
        };

        mgr_instance.refresh_devices(&app_handle, true);
        mgr_instance
    }

    pub fn refresh_devices(&mut self, app_handle: &AppHandle, force: bool) {
        let mut mgr = self.manager.lock().unwrap();
        let changed = mgr.refresh();
        if changed || force {
            let inputs = mgr.get_inputs();
            let outputs = mgr.get_outputs();
            let _ = app_handle.emit("midi:inputs", &inputs);
            let _ = app_handle.emit("midi:outputs", &outputs);
        }
    }

    pub fn add_route(&mut self, app_handle: &AppHandle, raw: MidiRouteRaw) {
        let route = MidiRoute::from_raw(raw);
        debug!("add_route: input='{}' output='{}' type='{}' enabled={}",
            route.input, route.output, route.route_type, route.enabled);
        let exists = self.routes.iter().any(|r| r.is_same(&route));
        if !exists {
            self.routes.push(route);
        }
        self.sync_shared_routes();
        self.apply_routes(app_handle);
    }

    pub fn delete_route(&mut self, app_handle: &AppHandle, raw: MidiRouteRaw) {
        let route = MidiRoute::from_raw(raw);
        debug!("delete_route: input='{}' output='{}'", route.input, route.output);
        self.routes.retain(|r| !r.is_same(&route));
        self.sync_shared_routes();
        self.apply_routes(app_handle);
    }

    pub fn clear_routes(&mut self, app_handle: &AppHandle) {
        debug!("clear_routes: clearing all routes");
        self.routes.clear();
        self.sync_shared_routes();
        self.apply_routes(app_handle);
    }

    pub fn sync_routes(&mut self, app_handle: &AppHandle, raw_routes: Vec<MidiRouteRaw>) {
        debug!("sync_routes: received {} routes", raw_routes.len());
        for (i, raw) in raw_routes.iter().enumerate() {
            debug!("  route[{}]: input='{}' output='{}' type='{}' enabled={}",
                i, raw.input, raw.output, raw.route_type, raw.enabled);
        }
        self.routes.clear();
        for raw in raw_routes {
            let route = MidiRoute::from_raw(raw);
            if route.enabled {
                let exists = self.routes.iter().any(|r| r.is_same(&route));
                if !exists {
                    self.routes.push(route);
                }
            }
        }
        self.sync_shared_routes();
        self.apply_routes(app_handle);
    }

    fn sync_shared_routes(&self) {
        let mut shared = self.routes_shared.lock().unwrap();
        *shared = self.routes.clone();
    }

    fn apply_routes(&mut self, app_handle: &AppHandle) {
        debug!("apply_routes: applying {} routes", self.routes.len());
        for route in &self.routes {
            debug!("  route: input='{}' output='{}' type='{}' enabled={}",
                route.input, route.output, route.route_type, route.enabled);
        }
        let mut mgr = self.manager.lock().unwrap();
        mgr.route_midi(&self.routes, app_handle);
        let wires = mgr.get_wires();
        debug!("apply_routes: emitting {} wires", wires.len());
        for w in &wires {
            debug!("  wire: input='{}' output='{}' connected={}",
                w.route.input, w.route.output, w.connected);
        }
        let _ = app_handle.emit("midi:wires", &wires);
    }

    pub fn get_inputs(&self) -> Vec<ApiMidiInput> {
        self.manager.lock().unwrap().get_inputs()
    }

    pub fn get_outputs(&self) -> Vec<ApiMidiOutput> {
        self.manager.lock().unwrap().get_outputs()
    }

    pub fn get_wires(&self) -> Vec<ApiMidiWire> {
        self.manager.lock().unwrap().get_wires()
    }

    pub fn stop_refresh_loop(&mut self) {
        {
            let mut running = self.refresh_running.lock().unwrap();
            *running = false;
        }
        if let Some(handle) = self.refresh_handle.take() {
            let _ = handle.join();
        }
    }

    // ===== Virtual Port Methods =====

    pub fn is_virtual_port_supported() -> bool {
        InnerManager::is_virtual_port_supported()
    }

    pub fn create_virtual_input(&mut self, app_handle: &AppHandle, name: &str) -> Result<(), String> {
        debug!("create_virtual_input: name='{}'", name);
        let mut mgr = self.manager.lock().unwrap();
        let result = mgr.create_virtual_input(name, app_handle);
        if result.is_ok() {
            // Refresh to emit updated inputs
            let inputs = mgr.get_inputs();
            let _ = app_handle.emit("midi:inputs", &inputs);
        }
        result
    }

    pub fn create_virtual_output(&mut self, app_handle: &AppHandle, name: &str) -> Result<(), String> {
        debug!("create_virtual_output: name='{}'", name);
        let mut mgr = self.manager.lock().unwrap();
        let result = mgr.create_virtual_output(name);
        if result.is_ok() {
            // Refresh to emit updated outputs
            let outputs = mgr.get_outputs();
            let _ = app_handle.emit("midi:outputs", &outputs);
        }
        result
    }

    pub fn delete_virtual_input(&mut self, app_handle: &AppHandle, name: &str) -> Result<(), String> {
        debug!("delete_virtual_input: name='{}'", name);
        let mut mgr = self.manager.lock().unwrap();
        let result = mgr.delete_virtual_input(name);
        if result.is_ok() {
            // Refresh to emit updated inputs
            let inputs = mgr.get_inputs();
            let _ = app_handle.emit("midi:inputs", &inputs);
        }
        result
    }

    pub fn delete_virtual_output(&mut self, app_handle: &AppHandle, name: &str) -> Result<(), String> {
        debug!("delete_virtual_output: name='{}'", name);
        let mut mgr = self.manager.lock().unwrap();
        let result = mgr.delete_virtual_output(name);
        if result.is_ok() {
            // Refresh to emit updated outputs
            let outputs = mgr.get_outputs();
            let _ = app_handle.emit("midi:outputs", &outputs);
        }
        result
    }

    pub fn get_virtual_inputs(&self) -> Vec<String> {
        self.manager.lock().unwrap().get_virtual_inputs()
    }

    pub fn get_virtual_outputs(&self) -> Vec<String> {
        self.manager.lock().unwrap().get_virtual_outputs()
    }
}
