use midir::{MidiInput, MidiOutput, MidiOutputConnection};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

use super::input_device::{ApiMidiInput, MidiInputDevice};
use super::internal_output::InternalOutput;
use super::output_device::{ApiMidiOutput, MidiOutputDevice};
use super::route::MidiRoute;
use super::wire::{ApiMidiWire, MidiWire};

const IGNORE_RTMIDI_REGEX: &str = "RtMidi";
const IGNORE_INPUT_REGEX: &str = "^output-internal";
const DEDUP_INTERVAL_MS: u128 = 5;
const DEDUP_CACHE_SIZE: usize = 32;
const DEBUG_MIDI: bool = true;

const MODULE_OUTPUTS: &[&str] = &[
    "chord-dictionary",
    "chord-display/default",
    "chord-quiz",
    "circle-of-fifths",
    "debugger",
];

type MidiInputConnection = midir::MidiInputConnection<()>;

#[derive(Clone)]
struct CachedMessage {
    data: Vec<u8>,
    timestamp_ms: u128,
}

struct MidiDedup {
    cache: Vec<CachedMessage>,
    index: usize,
}

impl MidiDedup {
    fn new() -> Self {
        Self {
            cache: Vec::with_capacity(DEDUP_CACHE_SIZE),
            index: 0,
        }
    }

    fn is_duplicate(&mut self, message: &[u8], timestamp_ms: u128) -> bool {
        for cached in &self.cache {
            if timestamp_ms.abs_diff(cached.timestamp_ms) <= DEDUP_INTERVAL_MS
                && cached.data.len() == message.len()
                && cached.data == message
            {
                return true;
            }
        }
        if self.cache.len() < DEDUP_CACHE_SIZE {
            self.cache.push(CachedMessage {
                data: message.to_vec(),
                timestamp_ms,
            });
        } else {
            self.cache[self.index % DEDUP_CACHE_SIZE] = CachedMessage {
                data: message.to_vec(),
                timestamp_ms,
            };
            self.index += 1;
        }
        false
    }
}

pub struct MidiDeviceManager {
    midi_in: Option<MidiInput>,
    midi_out: Option<MidiOutput>,
    inputs: HashMap<String, MidiInputDevice>,
    outputs: HashMap<String, OutputEntry>,
    wires: Vec<MidiWire>,
    active_connections: HashMap<String, MidiInputConnection>,
    active_output_connections: HashMap<String, MidiOutputConnection>,
    dedup: Arc<Mutex<MidiDedup>>,
}

enum OutputEntry {
    Physical(MidiOutputDevice),
    Internal(InternalOutput),
}

impl MidiDeviceManager {
    pub fn new() -> Self {
        let mut manager = Self {
            midi_in: MidiInput::new("midi-jar-input").ok(),
            midi_out: MidiOutput::new("midi-jar-output").ok(),
            inputs: HashMap::new(),
            outputs: HashMap::new(),
            wires: Vec::new(),
            active_connections: HashMap::new(),
            active_output_connections: HashMap::new(),
            dedup: Arc::new(Mutex::new(MidiDedup::new())),
        };
        manager.refresh_internal_outputs();
        manager
    }

    pub fn refresh(&mut self) -> bool {
        let mut changed = false;
        changed = self.refresh_internal_outputs() || changed;
        changed = self.refresh_inputs() || changed;
        changed = self.refresh_outputs() || changed;
        changed
    }

    fn refresh_internal_outputs(&mut self) -> bool {
        let mut changed = false;
        for &name in MODULE_OUTPUTS {
            if !self.outputs.contains_key(name) {
                self.outputs.insert(name.to_string(), OutputEntry::Internal(InternalOutput::new()));
                changed = true;
            }
        }
        changed
    }

    fn refresh_inputs(&mut self) -> bool {
        let mut changed = false;
        let mut found_inputs: Vec<String> = Vec::new();
        let mut has_loopback = false;

        let midi_in_ref = match self.midi_in.as_ref() {
            Some(m) => m,
            None => return false,
        };

        for port in midi_in_ref.ports() {
            if let Ok(name) = midi_in_ref.port_name(&port) {
                if name.contains(IGNORE_RTMIDI_REGEX) {
                    continue;
                }
                if let Ok(re) = regex::Regex::new(IGNORE_INPUT_REGEX) {
                    if re.is_match(&name) {
                        continue;
                    }
                }

                let is_loopback = name.contains("Loopback");
                if is_loopback && has_loopback {
                    if DEBUG_MIDI {
                        eprintln!("[MIDI_DEBUG] refresh_inputs: skipping duplicate loopback '{}'", name);
                    }
                    continue;
                }

                found_inputs.push(name.clone());
                if is_loopback {
                    has_loopback = true;
                }

                if let Some(existing) = self.inputs.get(&name) {
                    if !existing.connected {
                        self.inputs.get_mut(&name).unwrap().connected = true;
                        changed = true;
                    }
                } else {
                    self.inputs.insert(name.clone(), MidiInputDevice::new(name, true));
                    changed = true;
                }
            }
        }

        for input in self.inputs.values_mut() {
            if !found_inputs.contains(&input.name) && input.connected {
                input.connected = false;
                input.opened = false;
                changed = true;
            }
        }

        changed
    }

    fn refresh_outputs(&mut self) -> bool {
        let mut changed = false;
        let mut found_outputs: Vec<String> = Vec::new();

        let midi_out_ref = match self.midi_out.as_ref() {
            Some(m) => m,
            None => return false,
        };

        for port in midi_out_ref.ports() {
            if let Ok(name) = midi_out_ref.port_name(&port) {
                if name.contains(IGNORE_RTMIDI_REGEX) {
                    continue;
                }

                found_outputs.push(name.clone());

                let existing = self.outputs.get(&name);
                match existing {
                    Some(OutputEntry::Physical(dev)) => {
                        if !dev.connected {
                            self.outputs.get_mut(&name).unwrap().as_physical_mut().connected = true;
                            changed = true;
                        }
                    }
                    Some(OutputEntry::Internal(_)) => {
                        self.outputs.insert(name.clone(), OutputEntry::Physical(MidiOutputDevice::new(name, true)));
                        changed = true;
                    }
                    None => {
                        self.outputs.insert(name.clone(), OutputEntry::Physical(MidiOutputDevice::new(name, true)));
                        changed = true;
                    }
                }
            }
        }

        for (name, entry) in self.outputs.iter_mut() {
            if let OutputEntry::Physical(dev) = entry {
                if !found_outputs.contains(name) && dev.connected {
                    dev.connected = false;
                    dev.opened = false;
                    changed = true;
                }
            }
        }

        changed
    }

    pub fn route_midi(&mut self, routes: &[MidiRoute], app_handle: &AppHandle) {
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] route_midi: closing all connections and re-routing {} routes", routes.len());
        }
        self.close_all_connections();
        self.wires.clear();

        for route in routes {
            if route.enabled {
                let wire = MidiWire::new(route.clone());
                self.wires.push(wire);
                if DEBUG_MIDI {
                    eprintln!("[MIDI_DEBUG] route_midi: establishing connection for '{}' -> '{}' (type={})",
                        route.input, route.output, route.route_type);
                }
                self.establish_connection(&route, app_handle);
            }
        }

        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] route_midi: emitting {} wires (final)", self.wires.len());
            for w in &self.wires {
                eprintln!("[MIDI_DEBUG]   wire: '{}' -> '{}' connected={}",
                    w.route.input, w.route.output, w.connected);
            }
        }

        let _ = app_handle.emit("midi:wires", self.get_wires());
    }

    fn close_all_connections(&mut self) {
        self.active_connections.clear();
        self.active_output_connections.clear();
    }

    fn mark_wire_connected(&mut self, route: &MidiRoute) {
        if let Some(wire) = self.wires.iter_mut().find(|w| {
            w.route.input == route.input
                && w.route.output == route.output
                && w.route.route_type == route.route_type
        }) {
            wire.connected = true;
        }
    }

    fn establish_connection(&mut self, route: &MidiRoute, app_handle: &AppHandle) {
        let input_name = &route.input;
        let output_name = &route.output;
        let is_internal = route.route_type == "internal";

        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] establish_connection: input='{}' output='{}' is_internal={}",
                input_name, output_name, is_internal);
        }

        let midi_in = match MidiInput::new("midi-jar-route") {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[MIDI_DEBUG] establish_connection: FAILED to create MidiInput for '{}': {:?}", input_name, e);
                return;
            }
        };

        let all_ports = midi_in.ports();
        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] establish_connection: available input ports ({})", all_ports.len());
            for p in &all_ports {
                match midi_in.port_name(p) {
                    Ok(name) => eprintln!("[MIDI_DEBUG]   port: '{}'", name),
                    Err(e) => eprintln!("[MIDI_DEBUG]   port: <unnamed> error={:?}", e),
                }
            }
            eprintln!("[MIDI_DEBUG] establish_connection: searching for port matching '{}'", input_name);
        }

        let target_port = all_ports.into_iter().find(|p| {
            let ok = midi_in.port_name(p).ok().as_deref() == Some(input_name);
            if DEBUG_MIDI {
                match midi_in.port_name(p) {
                    Ok(name) => eprintln!("[MIDI_DEBUG]   comparing: '{}' == '{}' => {}", name, input_name, ok),
                    Err(_) => eprintln!("[MIDI_DEBUG]   comparing: <unnamed> == '{}' => false", input_name),
                }
            }
            ok
        });

        let port = match target_port {
            Some(p) => {
                if DEBUG_MIDI {
                    eprintln!("[MIDI_DEBUG] establish_connection: FOUND port for '{}'", input_name);
                }
                p
            }
            None => {
                eprintln!("[MIDI_DEBUG] establish_connection: PORT NOT FOUND for '{}'", input_name);
                eprintln!("[MIDI_DEBUG] establish_connection: available ports:");
                if let Ok(midi_in2) = MidiInput::new("midi-jar-debug") {
                    for p in midi_in2.ports() {
                        if let Ok(name) = midi_in2.port_name(&p) {
                            eprintln!("[MIDI_DEBUG]   '{}'", name);
                        }
                    }
                }
                return;
            }
        };

        let app_handle_clone = app_handle.clone();
        let input_name_clone = input_name.clone();
        let dedup_clone = self.dedup.clone();

        if DEBUG_MIDI {
            eprintln!("[MIDI_DEBUG] establish_connection: calling midi_in.connect() for '{}'", input_name);
        }

        let conn_result = midi_in.connect(
            &port,
            "midi-jar-route",
            move |stamp, message, _| {
                let timestamp = (stamp as f64) * 1000.0;

                {
                    let mut dedup = dedup_clone.lock().unwrap();
                    if dedup.is_duplicate(message, timestamp as u128) {
                        if DEBUG_MIDI {
                            eprintln!("[MIDI_DEBUG] >>> DEDUP SKIP device='{}' message={:?}",
                                input_name_clone, message);
                        }
                        return;
                    }
                }

                if DEBUG_MIDI {
                    eprintln!("[MIDI_DEBUG] >>> MIDI CALLBACK FIRED! device='{}' timestamp={} message={:?}",
                        input_name_clone, timestamp, message);
                }

                if is_internal {
                    for &module_name in MODULE_OUTPUTS {
                        let event_name = format!("midi:message:{}", module_name);
                        eprintln!("[MIDI_DEBUG] >>> emitting '{}' message={:?}",
                            event_name, message);
                        let _ = app_handle_clone.emit(&event_name, serde_json::json!({
                            "message": message,
                            "timestamp": timestamp,
                            "device": &input_name_clone
                        }));
                    }

                    eprintln!("[MIDI_DEBUG] >>> emitting 'midi:activity'");
                    let _ = app_handle_clone.emit("midi:activity", serde_json::json!({
                        "latency": 0.0,
                        "device": &input_name_clone
                    }));
                } else {
                    eprintln!("[MIDI_DEBUG] >>> physical output route (not yet implemented for external routing)");
                    let _ = app_handle_clone.emit("midi:activity", serde_json::json!({
                        "latency": 0.0,
                        "device": &input_name_clone
                    }));
                }
            },
            (),
        );

        match conn_result {
            Ok(conn) => {
                eprintln!("[MIDI_DEBUG] establish_connection: SUCCESS - connected to '{}'", input_name);
                self.active_connections.insert(input_name.clone(), conn);
                self.mark_wire_connected(route);
                if let Some(dev) = self.inputs.get_mut(input_name) {
                    dev.opened = true;
                    eprintln!("[MIDI_DEBUG] establish_connection: marked input '{}' as opened", input_name);
                }
            }
            Err(e) => {
                eprintln!("[MIDI_DEBUG] establish_connection: FAILED to connect to '{}': {}", input_name, e);
                if let Some(dev) = self.inputs.get_mut(input_name) {
                    dev.error = true;
                }
            }
        }

        if !is_internal {
            eprintln!("[MIDI_DEBUG] establish_connection: physical output routing for '{}'", output_name);
            if let Ok(midi_out) = MidiOutput::new("midi-jar-output") {
                let out_port = midi_out.ports().into_iter().find(|p| {
                    midi_out.port_name(p).ok().as_deref() == Some(output_name)
                });

                if let Some(port_ref) = out_port {
                    eprintln!("[MIDI_DEBUG] establish_connection: found output port '{}', connecting...", output_name);
                    match midi_out.connect(&port_ref, "midi-jar-output") {
                        Ok(conn) => {
                            eprintln!("[MIDI_DEBUG] establish_connection: SUCCESS - connected to output '{}'", output_name);
                            self.active_output_connections.insert(output_name.clone(), conn);
                            self.mark_wire_connected(route);
                            if let Some(entry) = self.outputs.get_mut(output_name) {
                                if let OutputEntry::Physical(dev) = entry {
                                    dev.opened = true;
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[MIDI_DEBUG] establish_connection: FAILED to connect output '{}': {}", output_name, e);
                        }
                    }
                } else {
                    eprintln!("[MIDI_DEBUG] establish_connection: output port '{}' not found among physical outputs", output_name);
                }
            }
        }
    }

    pub fn get_inputs(&self) -> Vec<ApiMidiInput> {
        self.inputs.values().map(|d| d.to_api()).collect()
    }

    pub fn get_outputs(&self) -> Vec<ApiMidiOutput> {
        let mut outputs: Vec<ApiMidiOutput> = Vec::new();

        let has_internal = MODULE_OUTPUTS.iter().any(|name| self.outputs.contains_key(*name));
        if has_internal {
            outputs.push(ApiMidiOutput {
                name: "internal".to_string(),
                output_type: "internal".to_string(),
                opened: true,
                connected: true,
                error: false,
            });
        }

        for entry in self.outputs.values() {
            if let OutputEntry::Physical(dev) = entry {
                outputs.push(dev.to_api());
            }
        }

        outputs
    }

    pub fn get_wires(&self) -> Vec<ApiMidiWire> {
        self.wires.iter().map(|w| w.to_api()).collect()
    }
}

impl OutputEntry {
    fn as_physical_mut(&mut self) -> &mut MidiOutputDevice {
        match self {
            OutputEntry::Physical(dev) => dev,
            OutputEntry::Internal(_) => panic!("Expected Physical output"),
        }
    }
}
