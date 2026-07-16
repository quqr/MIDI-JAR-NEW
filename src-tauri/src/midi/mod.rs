mod device_manager;
mod input_device;
mod internal_output;
mod output_device;
mod route;
mod wire;

pub use input_device::ApiMidiInput;
pub use output_device::ApiMidiOutput;
pub use route::MidiRoute;
pub use wire::ApiMidiWire;

use crate::MidiRouteRaw;
use device_manager::MidiDeviceManager as InnerManager;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

const REFRESH_LOOP_INTERVAL_MS: u64 = 1000;

#[cfg(debug_assertions)]
const DEBUG_MIDI: bool = true;
#[cfg(not(debug_assertions))]
const DEBUG_MIDI: bool = false;

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

                {
                    let mut mgr = manager_clone.lock().unwrap();
                    let changed = mgr.refresh();
                    if changed {
                        if DEBUG_MIDI {
                            eprintln!("[MIDI_DEBUG] refresh loop: device change detected");
                        }
                        let inputs: Vec<ApiMidiInput> = mgr.get_inputs();
                        let outputs: Vec<ApiMidiOutput> = mgr.get_outputs();
                        if DEBUG_MIDI {
                            eprintln!("[MIDI_DEBUG] refresh loop: {} inputs, {} outputs", inputs.len(), outputs.len());
                            for inp in &inputs {
                                eprintln!("[MIDI_DEBUG]   input: '{}' connected={} opened={}", inp.name, inp.connected, inp.opened);
                            }
                            for out in &outputs {
                                eprintln!("[MIDI_DEBUG]   output: '{}' type='{}' connected={}", out.name, out.output_type, out.connected);
                            }
                        }
                        let _ = app_handle_clone.emit("midi:inputs", &inputs);
                        let _ = app_handle_clone.emit("midi:outputs", &outputs);

                        let pending_routes = routes_shared_clone.lock().unwrap().clone();
                        if !pending_routes.is_empty() {
                            if DEBUG_MIDI {
                                eprintln!("[MIDI_DEBUG] refresh loop: re-applying {} routes", pending_routes.len());
                            }
                            mgr.route_midi(&pending_routes, &app_handle_clone);
                            let wires = mgr.get_wires();
                            if DEBUG_MIDI {
                                eprintln!("[MIDI_DEBUG] refresh loop: emitting {} wires after reconnect", wires.len());
                                for w in &wires {
                                    eprintln!("[MIDI_DEBUG]   wire: '{}' -> '{}' connected={}", w.route.input, w.route.output, w.connected);
                                }
                            }
                            let _ = app_handle_clone.emit("midi:wires", &wires);
                        }
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
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] add_route: input='{}' output='{}' type='{}' enabled={}",
                route.input, route.output, route.route_type, route.enabled);
        }
        let exists = self.routes.iter().any(|r| r.is_same(&route));
        if !exists {
            self.routes.push(route);
        }
        self.sync_shared_routes();
        self.apply_routes(app_handle);
    }

    pub fn delete_route(&mut self, app_handle: &AppHandle, raw: MidiRouteRaw) {
        let route = MidiRoute::from_raw(raw);
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] delete_route: input='{}' output='{}'", route.input, route.output);
        }
        self.routes.retain(|r| !r.is_same(&route));
        self.sync_shared_routes();
        self.apply_routes(app_handle);
    }

    pub fn clear_routes(&mut self, app_handle: &AppHandle) {
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] clear_routes: clearing all routes");
        }
        self.routes.clear();
        self.sync_shared_routes();
        self.apply_routes(app_handle);
    }

    pub fn sync_routes(&mut self, app_handle: &AppHandle, raw_routes: Vec<crate::MidiRouteRaw>) {
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] sync_routes: received {} routes", raw_routes.len());
            for (i, raw) in raw_routes.iter().enumerate() {
                eprintln!("[MIDI_DEBUG]   route[{}]: input='{}' output='{}' type='{}' enabled={}",
                    i, raw.input, raw.output, raw.route_type, raw.enabled);
            }
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
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] apply_routes: applying {} routes", self.routes.len());
            for route in &self.routes {
                eprintln!("[MIDI_DEBUG]   route: input='{}' output='{}' type='{}' enabled={}",
                    route.input, route.output, route.route_type, route.enabled);
            }
        }
        let mut mgr = self.manager.lock().unwrap();
        mgr.route_midi(&self.routes, app_handle);
        let wires = mgr.get_wires();
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] apply_routes: emitting {} wires", wires.len());
            for w in &wires {
                eprintln!("[MIDI_DEBUG]   wire: input='{}' output='{}' connected={}",
                    w.route.input, w.route.output, w.connected);
            }
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
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] create_virtual_input: name='{}'", name);
        }
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
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] create_virtual_output: name='{}'", name);
        }
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
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] delete_virtual_input: name='{}'", name);
        }
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
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] delete_virtual_output: name='{}'", name);
        }
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
