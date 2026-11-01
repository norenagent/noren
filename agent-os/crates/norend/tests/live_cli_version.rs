//! Live integration test for `noren version`.
//!
//! Hermetic and opt-in: spawns a real daemon against a temporary
//! `NOREN_HOME`, then runs the CLI version probe before waiting for
//! or reading the operator token. This covers the pre-auth protocol-info
//! path from the operator surface.

use serde_json::Value;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::sleep;

fn pick_free_port() -> u16 {
    let l = std::net::TcpListener::bind("127.0.0.1:0").expect("bind ephemeral");
    l.local_addr().unwrap().port()
}

fn noren_cli_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../target/debug/noren")
        .canonicalize()
        .expect("noren CLI binary not built; run `cargo build -p noren` first")
}

async fn wait_for_sock(path: &std::path::Path) -> bool {
    for _ in 0..100 {
        if path.exists() {
            return true;
        }
        sleep(Duration::from_millis(100)).await;
    }
    false
}

#[tokio::test]
#[ignore = "live: spawns norend + runs `noren version` subprocess"]
async fn live_cli_version_reads_protocol_info_without_token() {
    let home = tempfile::tempdir().expect("tempdir");
    let port = pick_free_port();
    let daemon_exe = env!("CARGO_BIN_EXE_norend");
    let mut child = Command::new(daemon_exe)
        .env("NOREN_HOME", home.path())
        .env("NOREN_HTTP_PORT", port.to_string())
        .env("HOME", home.path())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .expect("spawn norend");

    let sock = home.path().join("sock");
    if !wait_for_sock(&sock).await {
        let _ = child.kill().await;
        panic!("daemon never created its socket at {}", sock.display());
    }

    let cli_exe = noren_cli_bin();
    let version = Command::new(&cli_exe)
        .arg("version")
        .env("NOREN_HOME", home.path())
        .env("HOME", home.path())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .expect("spawn noren CLI (version)");
    let stdout = String::from_utf8_lossy(&version.stdout);
    let stderr = String::from_utf8_lossy(&version.stderr);
    assert!(
        version.status.success(),
        "version CLI failed: status={:?} stdout={stdout:?} stderr={stderr:?}",
        version.status
    );

    let body: Value = serde_json::from_slice(&version.stdout).expect("version stdout JSON");
    assert_eq!(body["protocol"], "noren.ipc");
    assert_eq!(body["version"], 1);
    assert_eq!(body["min_supported"], 1);
    assert_eq!(body["max_supported"], 2);

    let _ = child.kill().await;
}
