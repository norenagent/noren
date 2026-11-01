//! Live CLI coverage for `noren chain status --json`.
//!
//! Spawns a real daemon against a temp home, runs the status command
//! through the CLI, and asserts stdout is one stable JSON object. Opt-in
//! because it crosses process and socket boundaries. Run from `agent-os/`
//! after `cargo build -p noren`.

use serde_json::Value;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::sleep;

fn pick_free_port() -> u16 {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind ephemeral");
    listener.local_addr().unwrap().port()
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

async fn wait_for_operator_token(home: &std::path::Path) {
    let path = home.join("peers").join("operator.token");
    for _ in 0..50 {
        if let Ok(s) = std::fs::read_to_string(&path) {
            if !s.trim().is_empty() {
                return;
            }
        }
        sleep(Duration::from_millis(50)).await;
    }
    panic!("operator token never appeared at {}", path.display());
}

#[tokio::test]
#[ignore = "live: spawns norend + runs `noren chain status --json` subprocess"]
async fn live_cli_chain_status_json_round_trip() {
    let home = tempfile::tempdir().expect("tempdir");

    let port = pick_free_port();
    let daemon_exe = env!("CARGO_BIN_EXE_norend");
    let mut child = Command::new(daemon_exe)
        .env("NOREN_HOME", home.path())
        .env("NOREN_HTTP_PORT", port.to_string())
        .env("NOREN_CHAIN_NETWORK", "localnet")
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
    wait_for_operator_token(home.path()).await;

    let output = Command::new(noren_cli_bin())
        .args(["chain", "status", "--json"])
        .env("NOREN_HOME", home.path())
        .env("HOME", home.path())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .expect("spawn noren CLI");

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    assert!(
        output.status.success(),
        "CLI failed: status={:?} stdout={stdout:?} stderr={stderr:?}",
        output.status
    );
    assert!(
        stderr.trim().is_empty(),
        "chain status --json must not emit stderr on success: {stderr:?}"
    );

    let value: Value =
        serde_json::from_str(stdout.trim()).expect("chain status --json must be valid JSON");
    assert_eq!(value["kind"].as_str(), Some("chain_status"));
    assert_eq!(value["status"]["chain"].as_str(), Some("eip155:4663"));
    assert_eq!(value["status"]["cluster"].as_str(), Some("localnet"));
    assert_eq!(value["status"]["ready"].as_bool(), Some(false));
    assert_eq!(value["status"]["rpc_url"], Value::Null);
    assert!(
        value["status"]["missing"]
            .as_array()
            .expect("missing is array")
            .iter()
            .any(|field| field.as_str() == Some("NOREN_CHAIN_RPC_URL")),
        "missing must include unset RPC URL: {value:?}"
    );

    let _ = child.kill().await;
}
