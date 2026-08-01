#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WebKitGTK's DMA-BUF renderer can terminate with a Wayland protocol error
    // on some current Nobara/NVIDIA and compositor combinations. Harbor's UI
    // is lightweight, so the broadly compatible renderer is the safer default.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WAYLAND_DISPLAY").is_some() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Harbor");
}
