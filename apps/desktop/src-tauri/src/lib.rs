use tauri::Manager;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponse {
    status: u16,
    body: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DroppedTorrent {
    name: String,
    bytes: Vec<u8>,
}

#[tauri::command]
fn read_torrent_file(path: String) -> Result<DroppedTorrent, String> {
    let path = std::path::PathBuf::from(path);
    if path.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("torrent")) != Some(true) {
        return Err("Drop a .torrent file into Harbor".into());
    }
    let metadata = std::fs::metadata(&path).map_err(|_| "The dropped torrent file could not be read")?;
    if !metadata.is_file() || metadata.len() > 10 * 1024 * 1024 {
        return Err("Torrent files must be regular files smaller than 10 MB".into());
    }
    let name = path.file_name().and_then(|value| value.to_str()).ok_or("The torrent filename is invalid")?.to_string();
    let bytes = std::fs::read(path).map_err(|_| "The dropped torrent file could not be read")?;
    Ok(DroppedTorrent { name, bytes })
}

#[tauri::command]
async fn http_request(
    method: String,
    url: String,
    body: Option<String>,
    authorization: Option<String>,
) -> Result<HttpResponse, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|_| "The Harbor server address is invalid")?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Harbor only supports http:// or https:// server addresses".into());
    }
    let method = method
        .parse::<reqwest::Method>()
        .map_err(|_| "Unsupported HTTP method")?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|error| error.to_string())?;
    let mut request = client.request(method, parsed);
    if let Some(value) = authorization {
        request = request.header("authorization", value);
    }
    if let Some(value) = body {
        request = request.header("content-type", "application/json").body(value);
    }
    let response = request.send().await.map_err(|error| {
        if error.is_connect() { "Harbor could not reach that server. Check the IP address, port, and container status.".into() }
        else if error.is_timeout() { "The Harbor server did not respond within 15 seconds.".into() }
        else { format!("Harbor request failed: {error}") }
    })?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|error| error.to_string())?;
    Ok(HttpResponse { status, body })
}

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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            use tauri::{
                menu::{Menu, MenuItem},
                tray::TrayIconBuilder,
                Manager,
            };
            let open = MenuItem::with_id(app, "open", "Open Harbor", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Harbor", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("Harbor icon").clone())
                .tooltip("Harbor — downloads continue on Unraid")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![http_request, read_torrent_file])
        .run(tauri::generate_context!())
        .expect("error while running Harbor");
}

#[cfg(test)]
mod tests {
    use super::{http_request, read_torrent_file};
    use std::io::{Read, Write};
    use std::net::TcpListener;

    #[test]
    fn native_transport_reaches_a_lan_style_http_server() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0_u8; 2048];
            let _ = stream.read(&mut request).unwrap();
            stream.write_all(b"HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: 37\r\nConnection: close\r\n\r\n{\"error\":\"Pairing code is not valid\"}").unwrap();
        });
        let response = tauri::async_runtime::block_on(http_request(
            "POST".into(),
            format!("http://{address}/api/v1/pair"),
            Some("{}".into()),
            None,
        )).unwrap();
        server.join().unwrap();
        assert_eq!(response.status, 401);
        assert!(response.body.contains("Pairing code is not valid"));
    }

    #[test]
    fn native_transport_rejects_non_http_addresses() {
        let error = tauri::async_runtime::block_on(http_request("GET".into(), "file:///etc/passwd".into(), None, None)).unwrap_err();
        assert!(error.contains("http:// or https://"));
    }

    #[test]
    fn bodyless_post_does_not_claim_to_contain_json() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0_u8; 2048];
            let read = stream.read(&mut request).unwrap();
            stream.write_all(b"HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n").unwrap();
            String::from_utf8_lossy(&request[..read]).into_owned()
        });
        let response = tauri::async_runtime::block_on(http_request(
            "POST".into(),
            format!("http://{address}/api/v1/torrents/example/reannounce"),
            None,
            Some("Bearer test".into()),
        )).unwrap();
        let received = server.join().unwrap().to_ascii_lowercase();
        assert_eq!(response.status, 204);
        assert!(!received.contains("content-type"));
        assert!(received.contains("authorization: bearer test"));
    }

    #[test]
    fn dropped_torrent_reader_accepts_only_small_torrent_files() {
        let path = std::env::temp_dir().join(format!("harbor-{}.torrent", std::process::id()));
        std::fs::write(&path, b"d4:infod4:name4:testee").unwrap();
        let dropped = read_torrent_file(path.to_string_lossy().into_owned()).unwrap();
        assert!(dropped.name.ends_with(".torrent"));
        assert!(!dropped.bytes.is_empty());
        let _ = std::fs::remove_file(path);
        assert!(read_torrent_file("/tmp/not-a-torrent.txt".into()).is_err());
    }
}
