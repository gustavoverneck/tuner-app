// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod yin;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn detect_pitch(buffer: Vec<f32>, sample_rate: f32) -> Option<f32> {
    yin::yin_pitch_detection(&buffer, sample_rate)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, detect_pitch])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
