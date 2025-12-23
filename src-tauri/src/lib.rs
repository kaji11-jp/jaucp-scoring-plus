// JAUCP Scoring Tool - Rust Backend
use std::fs::OpenOptions;
use std::io::Write;
use std::panic;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // パニック時にエラーログをファイルに書き出す
    panic::set_hook(Box::new(|panic_info| {
        let log_path = std::env::current_dir()
            .unwrap_or_default()
            .join("panic_log.txt");
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&log_path)
        {
            let _ = writeln!(file, "PANIC: {}", panic_info);
            let _ = writeln!(
                file,
                "\nBacktrace:\n{:?}",
                std::backtrace::Backtrace::capture()
            );
        }
        eprintln!("PANIC: {}", panic_info);
    }));

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!());

    if let Err(e) = result {
        let log_path = std::env::current_dir()
            .unwrap_or_default()
            .join("error_log.txt");
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&log_path)
        {
            let _ = writeln!(file, "Tauri Error: {:?}", e);
        }
        eprintln!("Tauri Error: {:?}", e);
    }
}
