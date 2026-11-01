//! Norend binary entrypoint. Wires runtime + router + memory + settlement
//! + server and hands them a Unix listener at `$NOREN_HOME/sock`.

#![deny(unsafe_code)]

use anyhow::{Context, Result};
use std::sync::Arc;
use tokio::net::UnixListener;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    if let Some(arg) = std::env::args().nth(1) {
        match arg.as_str() {
            "--version" | "-V" => {
                println!("norend {}", env!("CARGO_PKG_VERSION"));
                return Ok(());
            }
            "--help" | "-h" => {
                println!(
                    "norend {version}\n\
                     local control plane for Noren agents\n\n\
                     usage:\n  \
                       norend                 start the daemon (config from $NOREN_HOME)\n  \
                       norend --version       print the version and exit\n  \
                       norend --help          print this help and exit\n",
                    version = env!("CARGO_PKG_VERSION"),
                );
                return Ok(());
            }
            other => {
                eprintln!("norend: unrecognised argument '{other}'. Try --help.");
                std::process::exit(2);
            }
        }
    }

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "norend=info".into()))
        .init();

    let home = norend::noren_home()?;
    std::fs::create_dir_all(&home).with_context(|| format!("create {}", home.display()))?;

    // Operator secrets that must not live in the repo — the RPC api-key,
    // funding-key paths — go in `$NOREN_HOME/operator.env`. Load it before any
    // NOREN_* config is resolved. dotenvy does not
    // override variables already set, so an explicit shell export still wins.
    let sap_env = home.join("operator.env");
    match dotenvy::from_path(&sap_env) {
        Ok(()) => info!(path = %sap_env.display(), "loaded operator env"),
        Err(dotenvy::Error::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => {
            tracing::warn!(error = %e, path = %sap_env.display(), "failed to load operator.env")
        }
    }

    let agents_dir = home.join("agents");
    let cards = noren_router::load_agents_from_dir(&agents_dir)
        .with_context(|| format!("load agents from {}", agents_dir.display()))?;
    info!(
        agents_dir = %agents_dir.display(),
        registered = cards.len(),
        "agents loaded"
    );
    let router = Arc::new(noren_router::Router::from_cards(cards));
    let runtime_config = norend::runtime_runner_config_from_env(&home)?;
    let hermes_config = norend::hermes_gateway_config_from_env();
    let subprocess_tracker = Arc::new(noren_runtime::SubprocessTracker::with_persistence(
        home.join("runtime").join("subprocess-tracker.jsonl"),
    ));
    // Re-adopt in-flight subprocess pids persisted by a prior daemon
    // instance BEFORE the tracker is handed to the runner/server or the
    // projection-tick driver spawns, so nothing races a half-populated
    // tracker. recover() validates each pid's ownership and re-tracks only
    // genuine survivors; reused or unverifiable pids are refused, never
    // signalled. Survivors that are over budget are reaped by the
    // projection tick on its next iteration.
    subprocess_tracker.recover();
    // A previous daemon that died mid-run can leave workspace directories,
    // quota tmpfs mounts and containers behind. Clear them before serving.
    {
        let report = noren_runtime::DockerWorkspaceRunner::new().sweep_stale();
        if report.removed > 0 || report.skipped > 0 {
            info!(
                removed = report.removed,
                skipped = report.skipped,
                "swept stale workspaces from a previous run"
            );
        }
    }
    // Live audit step-trail (opt-in via NOREN_LIVE_TRACE=1): the Hermes
    // runner streams each tool trace through this channel and the drainer
    // writes them into the chain as they arrive. Off by default — the proven
    // path folds the runner's runtime_events into the chain when the run ends.
    let live_trace = std::env::var("NOREN_LIVE_TRACE").ok().as_deref() == Some("1");
    let (runtime_event_tx, runtime_event_rx) = tokio::sync::mpsc::unbounded_channel();
    let runner = norend::runtime_runner_composite(
        &runtime_config,
        hermes_config.as_ref(),
        subprocess_tracker.clone(),
        live_trace.then_some(runtime_event_tx),
    );
    info!(
        backend = runtime_config.backend_name(),
        hermes = hermes_config.is_some(),
        "runtime runner ready"
    );

    // Probe the Hermes gateway up front when configured. A failed probe
    // or missing feature flag is non-fatal — we log loud so the operator
    // can fix it, then continue. Boot-time blocking on a remote service
    // would make a transient Hermes outage break Noren restarts.
    if let Some(cfg) = hermes_config.as_ref() {
        match noren_runtime::HermesRunner::new(cfg.base_url.clone(), cfg.api_key.clone()) {
            Ok(probe_runner) => match probe_runner.probe_capabilities().await {
                Some(caps) if caps.covers_runner() => {
                    info!(
                        base_url = %cfg.base_url,
                        sse = caps.run_events_sse,
                        stop = caps.run_stop,
                        approval = caps.run_approval_response,
                        "hermes gateway features confirmed",
                    );
                }
                Some(caps) => {
                    tracing::warn!(
                        base_url = %cfg.base_url,
                        run_submission = caps.run_submission,
                        run_events_sse = caps.run_events_sse,
                        run_stop = caps.run_stop,
                        "hermes gateway missing required features — dispatches may fail; upgrade to hermes-agent >= v0.12 or run with hermes disabled",
                    );
                }
                None => {
                    tracing::warn!(
                        base_url = %cfg.base_url,
                        "hermes capabilities probe failed (gateway unreachable or auth invalid) — hermes runtime will surface errors on first dispatch",
                    );
                }
            },
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    base_url = %cfg.base_url,
                    "hermes capabilities probe skipped — runner init failed",
                );
            }
        }
    }

    let memory_path = home.join("memory.db");
    let memory = Arc::new(
        noren_memory::SqliteStore::open(&memory_path)
            .with_context(|| format!("open memory store at {}", memory_path.display()))?,
    );
    info!(path = %memory_path.display(), "memory store open");

    let receipts_path = home.join("receipts").join("working.jsonl");
    let settlement = Arc::new(
        noren_settlement::JsonlReceiptStore::open(receipts_path.clone())
            .await
            .with_context(|| format!("open receipt log at {}", receipts_path.display()))?,
    );
    info!(path = %receipts_path.display(), "settlement receipt log open");

    let identity_path = home.join("identity").join("local.key");
    let identity = Arc::new(
        noren_identity::LocalIdentity::load_or_create(&identity_path, "user@local")
            .with_context(|| format!("load/create identity at {}", identity_path.display()))?,
    );
    info!(
        display = %identity.display(),
        pubkey = %noren_types::AgentId { display: String::new(), pubkey: identity.pubkey_bytes() }.pubkey_base58(),
        "local identity ready"
    );

    let audit_path = home.join("audit").join("events.jsonl");
    let audit = Arc::new(
        noren_audit::JsonlAuditLog::open(audit_path.clone())
            .await
            .with_context(|| format!("open audit log at {}", audit_path.display()))?,
    );
    info!(path = %audit_path.display(), "audit log open");

    let capabilities_path = home.join("capabilities").join("granted.jsonl");
    let capabilities = Arc::new(
        noren_permissions::JsonlCapabilityStore::open(capabilities_path.clone())
            .await
            .with_context(|| format!("open capability store at {}", capabilities_path.display()))?,
    );
    info!(path = %capabilities_path.display(), "capability store open");

    let secrets_path = home.join("secrets.toml");
    let embedder: Arc<dyn noren_llm::Embedder> =
        Arc::from(noren_llm::pick_embedder(&secrets_path).await);
    info!(embedder = %embedder.name(), "embedder ready");

    let ignore_path = home.join(".norenignore");
    if !ignore_path.exists() {
        if let Err(e) = std::fs::write(&ignore_path, default_ignorefile()) {
            tracing::warn!(error = %e, path = %ignore_path.display(), "could not seed default .norenignore");
        } else {
            info!(path = %ignore_path.display(), "seeded default .norenignore");
        }
    }
    let ignore = Arc::new(
        noren_memory::IgnoreSet::load(&ignore_path)
            .with_context(|| format!("load {}", ignore_path.display()))?,
    );
    info!(rules = ignore.len(), "ignore set loaded");

    let mut tools_vec: Vec<Arc<dyn noren_mcp::Tool>> = vec![
        Arc::new(noren_mcp::native::EchoTool),
        Arc::new(noren_mcp::native::ClockTool),
    ];
    let acedata_cfg = match acedata_from_env() {
        Some((client, cfg)) => {
            let added = noren_acedata::acedata_tools(Arc::new(client), &cfg);
            if added.is_empty() {
                tracing::warn!("acedata enabled but allowlist registered no tools");
                None
            } else {
                info!(count = added.len(), base_url = %cfg.base_url, "acedata provider enabled");
                tools_vec.extend(added);
                Some(cfg)
            }
        }
        None => None,
    };
    let mcp_cfg = noren_mcp::config::McpConfigFile::from_path(&secrets_path)
        .with_context(|| format!("parse mcp config in {}", secrets_path.display()))?;
    for srv in mcp_cfg.servers() {
        if !srv.enabled {
            info!(server = %srv.name, "mcp server disabled");
            continue;
        }
        match noren_mcp::transport::StdioMcpClient::spawn_with_env(
            &srv.command,
            &srv.args,
            &srv.env,
        )
        .await
        {
            Ok(client) => {
                let client_dyn: Arc<dyn noren_mcp::transport::McpClient> = client;
                let options = noren_mcp::external::RemoteToolOptions {
                    tool_prefix: srv.tool_prefix.clone(),
                    include: srv.include.clone(),
                    exclude: srv.exclude.clone(),
                };
                match noren_mcp::external::bootstrap_remote_tools_with_options(client_dyn, options)
                    .await
                {
                    Ok(remote) => {
                        info!(server = %srv.name, count = remote.len(), "mcp server ready");
                        tools_vec.extend(remote);
                    }
                    Err(e) => {
                        tracing::warn!(server = %srv.name, error = %e, "mcp bootstrap failed; skipping server");
                    }
                }
            }
            Err(e) => {
                tracing::warn!(server = %srv.name, command = %srv.command, error = %e, "mcp spawn failed; skipping server");
            }
        }
    }
    let tools = Arc::new(noren_mcp::ToolRegistry::from_tools(tools_vec));
    info!(count = tools.len(), tools = ?tools.names(), "tool registry ready");

    let mailbox_path = home.join("a2a").join("events.jsonl");
    let mailbox: Arc<dyn noren_a2a::Mailbox> = Arc::new(
        noren_a2a::JsonlMailbox::open(mailbox_path.clone())
            .await
            .with_context(|| format!("open a2a mailbox at {}", mailbox_path.display()))?,
    );
    info!(path = %mailbox_path.display(), "a2a mailbox open");

    // Cross-host A2A replay cache (slice 4b-2): restart-durable anti-replay
    // store for inbound envelopes admitted by `Server::admit_remote_a2a_task`.
    // A missing file is an empty cache; a corrupt one fails closed so the daemon
    // never boots having forgotten which envelopes it already admitted.
    let cross_host_dedup_path = home.join("a2a").join("cross-host-dedup.jsonl");
    let cross_host_dedup = Arc::new(
        norend::cross_host::JsonlCrossHostDedup::open(cross_host_dedup_path.clone())
            .await
            .with_context(|| {
                format!(
                    "open cross-host A2A dedup log at {}",
                    cross_host_dedup_path.display()
                )
            })?,
    );
    info!(path = %cross_host_dedup_path.display(), "cross-host a2a dedup log open");

    let peers_path = home.join("peers").join("registry.jsonl");
    let peers: Arc<dyn noren_peer_auth::PeerRegistry> = Arc::new(
        noren_peer_auth::JsonlPeerRegistry::open(peers_path.clone())
            .await
            .with_context(|| format!("open peer registry at {}", peers_path.display()))?,
    );
    info!(path = %peers_path.display(), "peer registry open");

    // Cross-host registry (slice 3): load-and-hold only — no dispatch, no
    // socket. A missing file is local-only (empty); a malformed or unreadable
    // one fails closed here so the daemon never boots believing peering is
    // configured when it is not.
    let known_hosts_path = norend::known_hosts_path(&home);
    let known_hosts = noren_peer_auth::KnownHosts::load_from_path(known_hosts_path.clone())
        .await
        .with_context(|| {
            format!(
                "load known-hosts registry at {}",
                known_hosts_path.display()
            )
        })?;
    info!(
        path = %known_hosts_path.display(),
        hosts = known_hosts.len(),
        "known-hosts registry loaded"
    );

    bootstrap_operator_token(&home, &peers, &identity).await?;

    let budget_path = home.join("budget").join("ledger.jsonl");
    let budget: Arc<dyn noren_budget::BudgetLedger> = Arc::new(
        noren_budget::JsonlLedger::open(budget_path.clone())
            .await
            .with_context(|| format!("open budget ledger at {}", budget_path.display()))?,
    );
    info!(path = %budget_path.display(), "budget ledger open");

    let budget_checkpoints_path = home.join("budget").join("checkpoints.jsonl");
    let budget_checkpoints = Arc::new(
        noren_budget::JsonlPauseCheckpointStore::open(budget_checkpoints_path.clone())
            .await
            .with_context(|| {
                format!(
                    "open budget checkpoint log at {}",
                    budget_checkpoints_path.display()
                )
            })?,
    );
    info!(path = %budget_checkpoints_path.display(), "budget checkpoint log open");

    let server = norend::Server::new(
        router,
        runner,
        memory,
        settlement,
        audit,
        capabilities,
        embedder,
        identity,
        ignore,
        tools,
        mailbox,
        peers,
        budget,
    )
    .with_home(home.clone())
    .with_known_hosts(known_hosts)
    .with_cross_host_dedup(cross_host_dedup)
    .with_budget_checkpoints(budget_checkpoints)
    .with_subprocess_tracker(subprocess_tracker);

    let server = match x402_dispatch_config_from_env() {
        Some(cfg) => {
            info!(
                signer = %cfg.signer_binary.display(),
                "x402 outbound dispatch enabled"
            );
            server.with_x402_dispatch(cfg)
        }
        None => server,
    };

    let server = match spend_authz_config_from_env() {
        Some(cfg) => {
            info!("spend authorization surface enabled");
            server.with_spend_authz(cfg)
        }
        None => server,
    };

    let server = match escrow_config_from_env() {
        Some(cfg) => {
            info!("escrow surface enabled");
            server.with_escrow(cfg)
        }
        None => server,
    };

    let server = match norend::spend_grant::SpendGrantConfig::from_env() {
        Some(cfg) => {
            let addr: String = cfg
                .attestor_address()
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect();
            info!(
                chain_id = cfg.chain_id(),
                attestor = %format!("0x{addr}"),
                "spend-grant facilitator enabled"
            );
            server.with_spend_grant(cfg)
        }
        None => server,
    };

    let server = match acedata_cfg {
        Some(cfg) => server.with_acedata(cfg),
        None => server,
    };

    let server = match norend::robinhood::RobinhoodConfig::from_env() {
        Some(cfg) => {
            info!(
                venue = %cfg.policy.venue,
                mode = ?cfg.policy.mode,
                telegram = cfg.telegram.is_some(),
                "robinhood governed-trading profile enabled"
            );
            server.with_robinhood(norend::robinhood::RobinhoodState::new(cfg))
        }
        None => server,
    };

    // Code agent: enabled only when the operator configured a model in the
    // daemon's own environment. The key is never logged.
    let server = match norend::code_agent::agent_provider_from_env() {
        Some(provider) => {
            info!("code agent enabled");
            server.with_agent_provider(provider)
        }
        None => server,
    };

    server
        .register_agent_budgets()
        .await
        .context("seed agent budget capacities from manifests")?;

    let a2a_retry_scheduler = norend::a2a_auto_retry_scheduler_config_from_env()?;
    let a2a_retry_scheduler_handle = if a2a_retry_scheduler.enabled {
        info!(
            interval_ms = a2a_retry_scheduler.interval_ms,
            min_lease_age_ms = a2a_retry_scheduler.policy.min_lease_age_ms,
            max_attempts = a2a_retry_scheduler.policy.max_attempts,
            max_requeues = a2a_retry_scheduler.policy.max_requeues,
            scan_limit = a2a_retry_scheduler.policy.scan_limit,
            "a2a auto retry scheduler enabled"
        );
        Some(norend::spawn_a2a_auto_retry_scheduler(
            server.clone(),
            a2a_retry_scheduler,
        ))
    } else {
        info!("a2a auto retry scheduler disabled");
        None
    };

    let projection_tick = norend::projection_tick_config_from_env()?;
    info!(
        period_ms = projection_tick.period_ms,
        grace_ms = projection_tick.grace_ms,
        "budget projection tick driver enabled"
    );
    let projection_tick_handle =
        norend::spawn_projection_tick_driver(server.clone(), projection_tick);

    // Fold live Hermes runtime traces into the audit chain as they stream in
    // (only when NOREN_LIVE_TRACE=1; otherwise traces fold at run end).
    // Even when the drainer is off, the broadcast channel is created so the
    // /intents/:id/events SSE handler in `norend::http` can still subscribe
    // without an Option<> dance; it just receives nothing until live trace is
    // enabled. Capacity is sized for a noisy run (Hermes can emit dozens of
    // tool-completed events per second) without back-pressuring the drainer.
    let (live_traces_tx, _) = tokio::sync::broadcast::channel::<noren_runtime::StreamedTrace>(1024);
    let runtime_event_drainer_handle = live_trace.then(|| {
        norend::spawn_runtime_event_drainer(
            server.clone(),
            runtime_event_rx,
            live_traces_tx.clone(),
        )
    });

    // HTTP gateway for browser UIs. Every protected route requires
    // `Authorization: Bearer <token>` resolved via the same peer
    // registry the Unix socket uses; only `/health` is open. Operator
    // / web UI reads the token from `$NOREN_HOME/peers/operator.token`.
    let http_port: u16 = std::env::var("NOREN_HTTP_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8421);
    let http_bind: std::net::IpAddr = std::env::var("NOREN_HTTP_BIND_ADDR")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(std::net::IpAddr::from([127, 0, 0, 1]));
    let http_addr = std::net::SocketAddr::new(http_bind, http_port);
    let http_state = norend::http::HttpState {
        server: server.clone(),
        live_traces_tx: live_traces_tx.clone(),
    };
    let http_router = norend::http::router(http_state);
    let http_listener = tokio::net::TcpListener::bind(http_addr)
        .await
        .with_context(|| format!("bind http {}", http_addr))?;
    info!(addr = %http_addr, "http gateway listening (bearer-auth enforced)");
    // Broadcast channel so shutdown can fan a single signal out to the HTTP
    // server (axum::serve's with_graceful_shutdown takes a future) without
    // moving the receiver into the spawned task — the main select! still
    // needs to send on it. Capacity 1 is enough: the only message is `()`,
    // and a single SIGTERM coalescing into one wakeup is the correct shape.
    let (shutdown_tx, mut shutdown_rx_http) = tokio::sync::broadcast::channel::<()>(1);
    let http_handle = tokio::spawn(async move {
        let serve = axum::serve(http_listener, http_router).with_graceful_shutdown(async move {
            // Recv resolves either when shutdown_tx.send fires or when every
            // sender is dropped; either way the server is meant to stop.
            let _ = shutdown_rx_http.recv().await;
        });
        if let Err(e) = serve.await {
            tracing::warn!(error = %e, "http gateway exited");
        }
    });

    let sock_path = home.join("sock");
    if sock_path.exists() {
        std::fs::remove_file(&sock_path)
            .with_context(|| format!("remove stale socket at {}", sock_path.display()))?;
    }
    let listener =
        UnixListener::bind(&sock_path).with_context(|| format!("bind {}", sock_path.display()))?;
    info!(path = %sock_path.display(), "norend listening");

    tokio::select! {
        _ = shutdown_signal() => {
            info!("shutdown requested");
            // Tell the HTTP server to stop accepting new connections and
            // drain in-flight ones; broadcast::send errors only when
            // there are zero subscribers, which the spawned http_handle
            // is still — unless it already exited on its own, in which
            // case the send error is correct to ignore.
            let _ = shutdown_tx.send(());
            let saved = server.save_shutdown_budget_checkpoints().await;
            info!(saved, "shutdown budget checkpoints saved");
        }
        res = server.serve(listener) => {
            res?;
        }
    }

    // Drain HTTP under a bounded deadline so a stuck in-flight request
    // can't wedge the supervisor's SIGTERM→SIGKILL window (systemd
    // defaults to 90s); the abort on timeout is the fallback, not the
    // primary path the way it was before.
    if !await_with_drain_timeout(http_handle, HTTP_DRAIN_DEADLINE).await {
        tracing::warn!(
            timeout_secs = HTTP_DRAIN_DEADLINE.as_secs(),
            "http drain exceeded deadline; aborting outstanding requests"
        );
    }
    if let Some(handle) = a2a_retry_scheduler_handle {
        handle.abort();
    }
    projection_tick_handle.abort();
    if let Some(h) = runtime_event_drainer_handle {
        h.abort();
    }
    if sock_path.exists() {
        let _ = std::fs::remove_file(&sock_path);
    }
    Ok(())
}

/// Maximum wall-clock budget for HTTP graceful-shutdown drain. systemd's
/// default `TimeoutStopSec` is 90s; staying comfortably below that lets the
/// rest of the shutdown path (budget checkpoint save, socket cleanup) finish
/// before the supervisor escalates to SIGKILL.
const HTTP_DRAIN_DEADLINE: std::time::Duration = std::time::Duration::from_secs(30);

/// Resolve when the process should stop accepting work: SIGINT (ctrl-c on
/// every target) or SIGTERM (systemd / Docker / Kubernetes `kill` on Unix).
/// The previous shutdown path only awaited ctrl_c, so SIGTERM under any
/// supervisor terminated the process immediately, skipping budget-checkpoint
/// save and socket cleanup. Composing both means the same drain path runs
/// regardless of which supervisor sent the signal.
async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::warn!(error = %e, "ctrl-c handler failed; using SIGTERM only");
            std::future::pending::<()>().await;
        }
    };
    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};
        match signal(SignalKind::terminate()) {
            Ok(mut s) => {
                s.recv().await;
            }
            Err(e) => {
                tracing::warn!(error = %e, "SIGTERM handler failed; using ctrl-c only");
                std::future::pending::<()>().await;
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
}

/// Wait for `handle` to complete, bounded by `timeout`. Returns `true` if the
/// handle finished within the deadline, `false` otherwise. On timeout the
/// JoinHandle is explicitly aborted and awaited to completion — without the
/// explicit abort, `tokio::time::timeout` would drop the JoinHandle and
/// merely DETACH the task (tokio's drop semantic), so a stuck handler would
/// keep running until the multi-thread runtime's drop discarded it. Aborting
/// is the behaviour the warn-log promises: drain the task immediately, don't
/// silently let it run on.
async fn await_with_drain_timeout<T>(
    mut handle: tokio::task::JoinHandle<T>,
    timeout: std::time::Duration,
) -> bool {
    match tokio::time::timeout(timeout, &mut handle).await {
        Ok(_) => true,
        Err(_) => {
            handle.abort();
            // The abort signal propagates at the next yield point; awaiting
            // here resolves to a JoinError::cancelled almost immediately and
            // confirms the task is gone before the shutdown path moves on.
            let _ = handle.await;
            false
        }
    }
}

/// Mint an operator token on first start (or read the existing one) and
/// register it in the peer registry under the daemon's local identity.
/// The token is the bootstrap credential the CLI and Web UI use to
/// authenticate; it lives at `$NOREN_HOME/peers/operator.token` with
/// mode `0600` so only the running user can read it.
async fn bootstrap_operator_token(
    home: &std::path::Path,
    peers: &Arc<dyn noren_peer_auth::PeerRegistry>,
    identity: &Arc<noren_identity::LocalIdentity>,
) -> Result<()> {
    let token_path = home.join("peers").join("operator.token");
    if let Some(parent) = token_path.parent() {
        std::fs::create_dir_all(parent).with_context(|| format!("create {}", parent.display()))?;
    }

    let token = if token_path.exists() {
        // The mode of the existing file is the operator's exposure.
        // If anything other than 0600, refuse to trust it — silently
        // regenerating would still leak the prior token to whoever
        // could read it. Loud failure forces operator action.
        norend::require_operator_token_mode_0600(&token_path).with_context(|| {
            format!(
                "operator token at {} has insecure permissions",
                token_path.display()
            )
        })?;
        let s = std::fs::read_to_string(&token_path)
            .with_context(|| format!("read operator token at {}", token_path.display()))?;
        match noren_peer_auth::PeerToken::from_b58(s.trim()) {
            Ok(t) => {
                // If the registry already resolves it, nothing to do.
                if peers.resolve(&t).await?.is_some() {
                    info!(path = %token_path.display(), "operator token reused");
                    return Ok(());
                }
                t
            }
            Err(e) => {
                tracing::warn!(error = %e, path = %token_path.display(), "operator token unreadable; regenerating");
                noren_peer_auth::PeerToken::generate()
            }
        }
    } else {
        noren_peer_auth::PeerToken::generate()
    };

    norend::write_operator_token_0600(&token_path, &token.to_b58())
        .with_context(|| format!("write operator token at {}", token_path.display()))?;

    let entry = noren_peer_auth::PeerEntry {
        token,
        agent_id: noren_types::AgentId::new(identity.display(), identity.pubkey_bytes()),
        registered_at: epoch_ms(),
    };
    peers.register(entry).await?;
    info!(path = %token_path.display(), display = %identity.display(), "operator token minted and registered");
    Ok(())
}

/// Build the outbound x402 dispatch config from env, or return None
/// when the operator hasn't opted in. Returning None keeps the daemon
/// running fully offline-from-payments — every `Request::PayX402`
/// will surface "not configured" until the operator sets these vars
/// and restarts.
///
/// Required when opted in:
/// - `NOREN_X402_ENABLED` truthy (`1`, `true`, `yes`)
/// - `NOREN_X402_SIGNER_BINARY` — path to a built
///   `noren-x402-signer` binary
///
/// Forwarded to the sidecar via its env:
/// - `NOREN_X402_EVM_KEY_HEX` or `NOREN_X402_EVM_KEY` — funding key (hex or file path)
/// - `NOREN_X402_EVM_VALID_SECS` — optional authorization lifetime
fn x402_dispatch_config_from_env() -> Option<norend::x402::X402Config> {
    let enabled = std::env::var("NOREN_X402_ENABLED")
        .map(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);
    if !enabled {
        return None;
    }
    let signer_binary = match std::env::var("NOREN_X402_SIGNER_BINARY") {
        Ok(path) => std::path::PathBuf::from(path),
        Err(_) => {
            tracing::warn!(
                "NOREN_X402_ENABLED is set but NOREN_X402_SIGNER_BINARY is not; outbound x402 dispatch will remain disabled"
            );
            return None;
        }
    };
    let mut signer_env = Vec::new();
    for key in [
        "NOREN_X402_EVM_KEY_HEX",
        "NOREN_X402_EVM_KEY",
        "NOREN_X402_EVM_VALID_SECS",
    ] {
        if let Ok(v) = std::env::var(key) {
            signer_env.push((key.to_string(), v));
        }
    }
    Some(norend::x402::X402Config {
        enabled: true,
        signer_binary,
        signer_env,
    })
}

/// Enable the spend-authorization surface when the operator opts in.
/// This path holds no keys and moves no funds — it only lets the daemon
/// answer `POST /spend/authorize` (approve or deny a wallet spend against
/// the caller's capability, per-call cap, and budget, recording every
/// verdict in the audit chain). Off by default.
///
/// - `NOREN_SPEND_AUTHZ_ENABLED` truthy (`1`, `true`, `yes`)
fn spend_authz_config_from_env() -> Option<norend::spend_authz::SpendAuthzConfig> {
    let enabled = std::env::var("NOREN_SPEND_AUTHZ_ENABLED")
        .map(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);
    if !enabled {
        return None;
    }
    Some(norend::spend_authz::SpendAuthzConfig { enabled: true })
}

/// Resolve the escrow surface config from env. When enabled the daemon will
/// answer `POST /escrow/prove` (issue a signed completion proof an external
/// escrow releases against) and `POST /escrow/release` (record the payout back
/// into the audit chain). Noren holds no funds. Off by default.
///
/// - `NOREN_ESCROW_ENABLED` truthy (`1`, `true`, `yes`)
fn escrow_config_from_env() -> Option<norend::escrow::EscrowConfig> {
    let enabled = std::env::var("NOREN_ESCROW_ENABLED")
        .map(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);
    if !enabled {
        return None;
    }
    Some(norend::escrow::EscrowConfig { enabled: true })
}

/// Build the AceData provider (client + config) from env, or None when
/// the operator hasn't opted in. Two billing modes: an API key (credit
/// billing) or, with no key, keyless x402 pay-per-call over the funding
/// signer. The API key takes precedence when both are set.
///
/// - `NOREN_ACEDATA_ENABLED` truthy (`1`, `true`, `yes`)
/// - `NOREN_ACEDATA_API_KEY` — Bearer billing token (credit mode)
/// - `NOREN_ACEDATA_BASE_URL` — override the API host (optional)
/// - `NOREN_ACEDATA_ALLOW` — comma-separated tool-name allowlist (optional)
/// - `NOREN_ACEDATA_IMAGE_MODEL` / `NOREN_ACEDATA_MUSIC_MODEL` — default models (optional)
/// - `NOREN_ACEDATA_X402_MAX_ATOMIC` — per-call USDC cap for x402 mode (optional; default 1 USDC)
///
/// Keyless x402 mode additionally needs the x402 signer sidecar:
/// `NOREN_X402_ENABLED` + `NOREN_X402_SIGNER_BINARY` +
/// `NOREN_X402_EVM_KEY_HEX`.
fn acedata_from_env() -> Option<(noren_acedata::AceDataClient, noren_acedata::AceDataConfig)> {
    let enabled = std::env::var("NOREN_ACEDATA_ENABLED")
        .map(|v| matches!(v.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);
    if !enabled {
        return None;
    }
    let mut cfg = noren_acedata::AceDataConfig {
        enabled: true,
        ..Default::default()
    };
    if let Ok(url) = std::env::var("NOREN_ACEDATA_BASE_URL") {
        if !url.trim().is_empty() {
            cfg.base_url = url;
        }
    }
    if let Ok(list) = std::env::var("NOREN_ACEDATA_ALLOW") {
        cfg.allow = Some(
            list.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
        );
    }
    if let Ok(m) = std::env::var("NOREN_ACEDATA_IMAGE_MODEL") {
        if !m.trim().is_empty() {
            cfg.image_model = m;
        }
    }
    if let Ok(m) = std::env::var("NOREN_ACEDATA_MUSIC_MODEL") {
        if !m.trim().is_empty() {
            cfg.music_model = m;
        }
    }
    // Two billing modes. An API key takes precedence (credit billing).
    // With no key, fall back to keyless x402 pay-per-call when the x402
    // signer sidecar is configured (NOREN_X402_*): each call pays USDC
    // on Robinhood Chain through the funding key, no AceData credential at all.
    match std::env::var("NOREN_ACEDATA_API_KEY") {
        Ok(k) if !k.trim().is_empty() => {
            let client = noren_acedata::AceDataClient::new(cfg.base_url.clone(), k);
            Some((client, cfg))
        }
        _ => match x402_dispatch_config_from_env() {
            Some(x402) => {
                let mut signer = norend::x402::SubprocessSigner::new(&x402.signer_binary);
                for (key, value) in &x402.signer_env {
                    signer = signer.env(key, value);
                }
                let max_atomic = std::env::var("NOREN_ACEDATA_X402_MAX_ATOMIC")
                    .ok()
                    .and_then(|v| v.trim().parse().ok())
                    .unwrap_or(0);
                let payer = noren_acedata::X402Payer::new(std::sync::Arc::new(signer))
                    .with_max_atomic(max_atomic);
                info!(
                    base_url = %cfg.base_url,
                    signer = %x402.signer_binary.display(),
                    "acedata enabled in keyless x402 pay-per-call mode (no API key)"
                );
                let client = noren_acedata::AceDataClient::with_x402(cfg.base_url.clone(), payer);
                Some((client, cfg))
            }
            None => {
                tracing::warn!(
                    "NOREN_ACEDATA_ENABLED set but neither NOREN_ACEDATA_API_KEY nor the \
                     x402 signer (NOREN_X402_ENABLED + NOREN_X402_SIGNER_BINARY) is \
                     configured; acedata disabled"
                );
                None
            }
        },
    }
}

fn epoch_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn default_ignorefile() -> &'static str {
    "# .norenignore — patterns matched against intent text and any other\n\
     # auto-ingested content. gitignore-style; '!' un-ignores; '/' anchors.\n\
     # Last matching rule wins.\n\
     #\n\
     # Default rules cover the obvious credential paths. Edit freely.\n\
     \n\
     **/.env\n\
     **/.env.*\n\
     **/secrets.toml\n\
     **/secrets.json\n\
     **/*.pem\n\
     **/*.key\n\
     **/id_rsa*\n\
     **/id_ed25519*\n\
     **/.ssh/**\n\
     **/credentials\n\
     **/credentials.json\n\
     **/.aws/credentials\n"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_ignorefile_pins_each_credential_path_pattern_and_operator_comment_header() {
        // default_ignorefile is the security-critical bootstrap
        // content written to ~/.noren/.norenignore on first
        // daemon start (the std::fs::write call gated by
        // `if !ignore_path.exists()` near the daemon-home bootstrap
        // block). The function encodes the
        // documented floor of credential patterns the daemon must NOT
        // auto-ingest under any operator config — .env, secrets.toml,
        // secrets.json, *.pem, *.key, id_rsa*, id_ed25519*, .ssh/**,
        // credentials, credentials.json, .aws/credentials.
        //
        // The function has no direct test today; its content is
        // exercised only indirectly through the daemon's bootstrap
        // path. A refactor that dropped '**/.env' under a 'let
        // operators decide their own rules' rationale would silently
        // let every new daemon auto-ingest .env files containing API
        // keys; a refactor that renamed '**/id_rsa*' to '*id_rsa*'
        // would silently widen the glob (root-only vs any-depth) and
        // let id_rsa-style filenames slip through in nested locations.
        let body = default_ignorefile();

        for pattern in [
            "**/.env",
            "**/.env.*",
            "**/secrets.toml",
            "**/secrets.json",
            "**/*.pem",
            "**/*.key",
            "**/id_rsa*",
            "**/id_ed25519*",
            "**/.ssh/**",
            "**/credentials",
            "**/credentials.json",
            "**/.aws/credentials",
        ] {
            assert!(
                body.contains(pattern),
                "default_ignorefile must contain {pattern:?} as a substring \
                 — this is the documented floor that protects every new \
                 daemon from auto-ingesting credentials. A refactor that \
                 dropped or renamed this pattern would silently let \
                 matching files leak into the audit chain and memory \
                 store on first daemon start, before the operator has a \
                 chance to edit .norenignore",
            );
        }

        assert!(
            body.starts_with('#'),
            "default_ignorefile must begin with a '#' comment line so \
             operators opening ~/.noren/.norenignore see a \
             documented file rather than raw glob patterns — the \
             leading comment block explains the gitignore-style \
             semantics ('!' un-ignores; '/' anchors; last matching \
             rule wins) that operators rely on when extending the \
             rule set",
        );

        assert!(
            body.contains("# .norenignore"),
            "default_ignorefile must carry the documented header line \
             '# .norenignore — ...' so the file is self-identifying \
             when opened in isolation (e.g., from a backup tarball or \
             a copied home directory); a refactor that dropped the \
             header would force operators to remember which daemon \
             owns the file",
        );

        assert!(
            body.contains("gitignore-style"),
            "default_ignorefile must surface the 'gitignore-style' \
             contract in the comment block so operators know the \
             match semantics (last rule wins, '!' un-ignore, '/' \
             anchor) WITHOUT consulting external docs — a refactor \
             that dropped this phrase would silently let operators \
             assume CSV or fnmatch semantics and introduce broken \
             un-ignore rules that mask credential leaks",
        );
    }

    #[tokio::test]
    async fn await_with_drain_timeout_reports_false_and_aborts_handle_when_deadline_exceeded() {
        // The shutdown path replaces the prior `http_handle.abort()` with
        // a bounded drain. Two contracts must hold for the warn-log to be
        // honest: (a) `false` is returned on timeout so the caller emits
        // the warning, and (b) the underlying task is actually aborted
        // (not just detached, which is what `tokio::time::timeout` does
        // when given the JoinHandle by value — the task would keep running
        // until the runtime's drop discarded it, contradicting the warn
        // log). A Drop guard on the spawned task pins this: the guard's
        // Drop fires when the task itself terminates (normal completion OR
        // abort), but not when only the JoinHandle is dropped.
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;
        struct TerminationGuard(Arc<AtomicBool>);
        impl Drop for TerminationGuard {
            fn drop(&mut self) {
                self.0.store(true, Ordering::SeqCst);
            }
        }
        let terminated = Arc::new(AtomicBool::new(false));
        let probe = terminated.clone();
        let handle = tokio::spawn(async move {
            let _guard = TerminationGuard(probe);
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        });
        let ok = await_with_drain_timeout(handle, std::time::Duration::from_millis(50)).await;
        assert!(
            !ok,
            "await_with_drain_timeout must return false when the handle is still running past the deadline"
        );
        assert!(
            terminated.load(Ordering::SeqCst),
            "spawned task must be aborted-and-joined (TerminationGuard::drop \
             fires) — a refactor that passed the JoinHandle by value to \
             tokio::time::timeout without explicit abort would DETACH the \
             task instead, leaving the guard alive in the background and \
             failing this assertion"
        );
    }

    #[tokio::test]
    async fn await_with_drain_timeout_reports_true_when_handle_completes_in_time() {
        // The paired success case: a well-behaved task that finishes inside
        // the deadline must return true so the shutdown log doesn't falsely
        // warn about a drain timeout.
        let handle = tokio::spawn(async {});
        let ok = await_with_drain_timeout(handle, std::time::Duration::from_secs(2)).await;
        assert!(
            ok,
            "await_with_drain_timeout must return true when the handle finishes inside the deadline"
        );
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn shutdown_signal_installs_sigterm_watcher_without_returning_immediately() {
        // Smoke test: the unix branch of shutdown_signal installs a SIGTERM
        // watcher via tokio::signal::unix::signal(SignalKind::terminate()).
        // A refactor that returned the unit immediately from the SIGTERM
        // arm (e.g., misuse of std::future::ready over std::future::pending
        // in the error fallback) would make shutdown_signal resolve as
        // soon as it starts, bypassing the supervisor drain entirely.
        //
        // Self-raising SIGTERM inside cargo test is unsafe — tokio installs
        // signal handlers process-globally, but other in-flight test
        // threads do not, so a real SIGTERM would either kill the harness
        // (if delivered before our handler is registered) or be absorbed
        // by a different test's watcher. Instead this test asserts the
        // composition is await-blocking under normal conditions: spawn
        // shutdown_signal in a task, yield long enough for any non-
        // blocking arm to complete if it existed, then assert the task is
        // still running. A regression that made shutdown_signal Ready
        // immediately would fail here.
        use std::time::Duration;
        let signal_task = tokio::spawn(shutdown_signal());
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert!(
            !signal_task.is_finished(),
            "shutdown_signal must await on the signal arms — a refactor that \
             made either arm Ready immediately (e.g., std::future::ready in \
             the SIGTERM error fallback instead of std::future::pending) \
             would surface here. The supervisor drain depends on the future \
             actually blocking until SIGINT or SIGTERM arrives."
        );
        signal_task.abort();
    }
}
