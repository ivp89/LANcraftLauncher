use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

const BEACON_PORT: u16 = 35891;
const PROBE_TIMEOUT_SECS: u64 = 2;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerInfo {
    pub address: String,
    pub name: String,
    pub version: String,
}

#[derive(Debug, Deserialize)]
struct BeaconMessage {
    #[serde(rename = "Address")]
    address: Option<String>,
    #[serde(rename = "Name")]
    name: Option<String>,
    #[serde(rename = "Version")]
    version: Option<String>,
}

#[tauri::command]
pub async fn discover_servers() -> Result<Vec<ServerInfo>, String> {
    tokio::task::spawn_blocking(|| {
        let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
        socket
            .set_broadcast(true)
            .map_err(|e| e.to_string())?;
        socket
            .set_read_timeout(Some(Duration::from_secs(PROBE_TIMEOUT_SECS)))
            .map_err(|e| e.to_string())?;

        // Send broadcast probe
        let probe_id = uuid_bytes();
        let broadcast = SocketAddr::new(
            IpAddr::V4(Ipv4Addr::BROADCAST),
            BEACON_PORT,
        );
        socket
            .send_to(&probe_id, broadcast)
            .map_err(|e| e.to_string())?;

        // Collect responses within timeout
        let mut servers = Vec::new();
        let mut buf = [0u8; 1024];

        loop {
            match socket.recv_from(&mut buf) {
                Ok((len, _)) => {
                    let msg = std::str::from_utf8(&buf[..len]).unwrap_or("");
                    if let Ok(beacon) = serde_json::from_str::<BeaconMessage>(msg) {
                        servers.push(ServerInfo {
                            address: beacon.address.unwrap_or_default(),
                            name: beacon.name.unwrap_or_else(|| "LANCommander".to_string()),
                            version: beacon.version.unwrap_or_default(),
                        });
                    }
                }
                Err(_) => break, // timeout or error → stop
            }
        }

        Ok(servers)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn uuid_bytes() -> Vec<u8> {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("{:x}-probe", t).into_bytes()
}
