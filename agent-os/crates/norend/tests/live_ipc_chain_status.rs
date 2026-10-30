//! Live integration test: spawns norend against a tempdir HOME and drives
//! `Request::ChainStatus` over the raw IPC socket, asserting the daemon's
//! `Response::ChainStatus` snapshot for the unconfigured and fully-configured
//! chain-env states.
//!
//! `chain_status()` resolves `chain_status_from_env()` — a pure read of the
//! Robinhood Chain env vars with no RPC and no signer — so the test is fully offline.
//! The verb is covered today over the CLI (`live_cli_chain_status_json.rs`) and
//! HTTP (`live_http_chain_status.rs`) but never over the raw Unix socket the CLI
//! is built on. This pins that wire contract: the `missing` list and its order,
//! the `devnet` cluster default, and the `ready = missing.is_empty()` rule.
//!
//! Hermetic — config is read from env, nothing dials out. Each spawn clears the
//! inherited chain env so the result is host-independent. `#[ignore]`'d. Run
//! with `cargo test -p norend --test live_ipc_chain_status -- --ignored live_`.

use noren_ipc::{read_frame, write_frame, Request, Response};
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::net::UnixStream;
use tokio::process::{Child, Command};
use tokio::time::sleep;

fn pick_free_port() -> u16 {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind ephemeral");
    listener.local_addr().unwrap().port()
}

async fn wait_for_sock(path: &Path) -> bool {
    for _ in 0..100 {
        if path.exists() {
            return true;
        }
        sleep(Duration::from_millis(100)).await;
    }
    false
}

async fn read_operator_token(home: &Path) -> String {
    let path = home.join("peers").join("operator.token");
    for _ in 0..50 {
        if let Ok(s) = std::fs::read_to_string(&path) {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
        sleep(Duration::from_millis(50)).await;
    }
    panic!("operator token never appeared at {}", path.display());
}

/// Spawn norend against `home`, clearing inherited chain env so the status
/// is host-independent, then applying `env` overrides.
async fn spawn_daemon(home: &Path, env: &[(&str, &str)]) -> Child {
    let port = pick_free_port();
    let exe = env!("CARGO_BIN_EXE_norend");
    let mut cmd = Command::new(exe);
    cmd.env("NOREN_HOME", home)
        .env("NOREN_HTTP_PORT", port.to_string())
        .env("HOME", home)
        .env_remove("NOREN_CHAIN_NETWORK")
        .env_remove("NOREN_CHAIN_RPC_URL")
        .env_remove("NOREN_CHAIN_WS_URL")
        .env_remove("NOREN_SETTLEMENT_CONTRACT")
        .env_remove("NOREN_TOKEN_ADDRESS");
    for (key, value) in env {
        cmd.env(key, value);
    }
    let child = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .expect("spawn norend");
    if !wait_for_sock(&home.join("sock")).await {
        panic!("daemon never created its socket");
    }
    child
}

/// Authenticate as the operator over the socket and send one
/// `Request::ChainStatus`, returning the decoded response.
async fn chain_status(home: &Path) -> Response {
    let mut stream = UnixStream::connect(home.join("sock"))
        .await
        .expect("connect socket");
    let token = read_operator_token(home).await;
    write_frame(&mut stream, &Request::Authenticate { token_b58: token })
        .await
        .expect("write authenticate");
    match read_frame(&mut stream).await.expect("read authenticate") {
        Response::Authenticated { .. } => {}
        other => panic!("authenticate failed: {other:?}"),
    }
    write_frame(&mut stream, &Request::ChainStatus)
        .await
        .expect("write chain status");
    read_frame(&mut stream).await.expect("read chain status")
}

#[tokio::test]
#[ignore = "live: spawns norend with no chain env + asserts Request::ChainStatus reports the unconfigured/not-ready status"]
async fn live_ipc_chain_status_unconfigured_reports_missing_vars() {
    let home = tempfile::tempdir().expect("tempdir");
    let mut child = spawn_daemon(home.path(), &[]).await;

    match chain_status(home.path()).await {
        Response::ChainStatus { status } => {
            assert_eq!(status.chain, "eip155:4663", "chain must be eip155:4663");
            assert_eq!(status.cluster, "devnet", "cluster must default to devnet");
            assert!(
                !status.ready,
                "an unconfigured daemon must not be chain-ready"
            );
            assert_eq!(status.rpc_url, None);
            assert_eq!(status.ws_url, None);
            assert_eq!(status.program_id, None);
            assert_eq!(status.token_address, None);
            assert_eq!(
                status.missing,
                vec![
                    "NOREN_CHAIN_RPC_URL",
                    "NOREN_SETTLEMENT_CONTRACT",
                    "NOREN_TOKEN_ADDRESS"
                ],
                "missing must list the three required vars in declaration order"
            );
        }
        other => panic!("expected Response::ChainStatus, got {other:?}"),
    }

    let _ = child.kill().await;
    let _ = child.wait().await;
}

#[tokio::test]
#[ignore = "live: spawns norend with a full chain env + asserts Request::ChainStatus reports configured/ready"]
async fn live_ipc_chain_status_configured_reports_ready() {
    let home = tempfile::tempdir().expect("tempdir");
    // Inert placeholders — chain_status_from_env only reads the strings; nothing
    // is dialed or validated, so the test stays hermetic.
    let mut child = spawn_daemon(
        home.path(),
        &[
            ("NOREN_CHAIN_NETWORK", "mainnet"),
            ("NOREN_CHAIN_RPC_URL", "https://rpc.example.invalid"),
            ("NOREN_CHAIN_WS_URL", "wss://ws.example.invalid"),
            (
                "NOREN_SETTLEMENT_CONTRACT",
                "Cov1111111111111111111111111111111111111111",
            ),
            ("NOREN_TOKEN_ADDRESS", "0x0000000000000000000000000000000000000001"),
        ],
    )
    .await;

    match chain_status(home.path()).await {
        Response::ChainStatus { status } => {
            assert_eq!(status.chain, "eip155:4663");
            assert_eq!(
                status.cluster, "mainnet",
                "cluster must echo NOREN_CHAIN_NETWORK"
            );
            assert!(
                status.ready,
                "all three required vars set must make the daemon chain-ready"
            );
            assert!(
                status.missing.is_empty(),
                "no required vars may be missing: {:?}",
                status.missing
            );
            assert_eq!(
                status.rpc_url.as_deref(),
                Some("https://rpc.example.invalid")
            );
            assert_eq!(status.ws_url.as_deref(), Some("wss://ws.example.invalid"));
            assert_eq!(
                status.program_id.as_deref(),
                Some("Cov1111111111111111111111111111111111111111")
            );
            assert_eq!(
                status.token_address.as_deref(),
                Some("0x0000000000000000000000000000000000000001")
            );
        }
        other => panic!("expected Response::ChainStatus, got {other:?}"),
    }

    let _ = child.kill().await;
    let _ = child.wait().await;
}
