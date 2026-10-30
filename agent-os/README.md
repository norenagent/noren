# Noren Agent OS

`agent-os/` contains the local operating-layer runtime: the daemon, CLI, shared protocol crates, agent runtime, memory, identity, permissions, audit, peer auth, MCP/A2A adapters, local operator console, and the settlement program (deployed on Robinhood Chain mainnet; daemon-driven lifecycle not yet production).

## Build

From this directory:

```bash
cargo build --workspace --exclude noren-settlement-program
```

The two primary binaries are:

- `target/debug/norend`: local daemon
- `target/debug/noren`: CLI client

## Source Install

Preview the local install plan:

```bash
node scripts/install-source.mjs --prefix /tmp/noren --dry-run --json
```

Install the daemon and CLI from source:

```bash
node scripts/install-source.mjs --prefix /tmp/noren --profile release
```

The installer copies `norend` and `noren` into `<prefix>/bin` and writes `<prefix>/share/noren/install-manifest.json`. See [`../docs/source-install.md`](../docs/source-install.md) for the source-built install boundary.

## Validate

Scripts-only gate:

```bash
./scripts/validate.sh --scripts
```

Fast local gate:

```bash
./scripts/validate.sh --quick
```

Full Rust gate:

```bash
./scripts/validate.sh
```

Live tests are opt-in:

```bash
cargo test --workspace --exclude noren-settlement-program -- --ignored live_
```

## Autonomy Artifacts

The autonomous workflow has a machine-readable control surface — a lifecycle
definition, scoped task records with gates and verification, an append-only
transition log, and a durable seed queue — implemented by engineering-loop
tooling alongside the public scripts. The recursive engineering model in
[BUILT.md](../BUILT.md) describes the contract that those tools implement.

## Runtime State

The daemon stores local state under `$NOREN_HOME`. If unset, it uses `$HOME/.noren`.

Common paths:

| Path | Purpose |
|---|---|
| `sock` | Unix socket for local clients. |
| `agents/` | Agent manifest directory loaded at startup. |
| `identity/local.key` | Local ed25519 seed. |
| `peers/operator.token` | Local operator token. |
| `peers/registry.jsonl` | Peer registry and tombstones. |
| `capabilities/granted.jsonl` | Signed capability grants. |
| `capabilities/revoked.jsonl` | Capability revocation tombstones. |
| `audit/events.jsonl` | Append-only audit log. |
| `audit/events.chain.jsonl` | Local hash-chain sidecar for audit integrity verification. |
| `memory.db` | SQLite memory store. |
| `receipts/working.jsonl` | Local settlement receipts. |
| `budget/ledger.jsonl` | Per-agent token-bucket budget ledger events. |
| `budget/checkpoints.jsonl` | Pause checkpoints for resumable budget-exhausted dispatches. |
| `runtime/gvisor` | Default scratch root when `NOREN_RUNTIME_BACKEND=linux-gvisor`. |

## Runtime Backend

`norend` defaults to trusted-local subprocess execution:

```bash
NOREN_RUNTIME_BACKEND=trusted-local
```

To opt into the initial Linux gVisor runner:

```bash
NOREN_RUNTIME_BACKEND=linux-gvisor
NOREN_GVISOR_ROOTFS=/path/to/rootfs
```

Optional settings:

```bash
NOREN_RUNSC=runsc
NOREN_GVISOR_SCRATCH=$NOREN_HOME/runtime/gvisor
```

The daemon fails startup when `linux-gvisor` is selected without a rootfs. Trusted-local execution refuses manifests that declare `sandbox.required = true`; it does not silently downgrade sandbox-required agents.

The real `runsc` dispatch path has ignored live coverage. It is skipped unless a Linux host rootfs is provided:

```bash
NOREN_LIVE_GVISOR_ROOTFS=/path/to/rootfs \
  cargo test -p noren-runtime --test live_gvisor -- --ignored live_gvisor_runner_dispatches_with_runsc
```

The Linux host, `runsc`, rootfs, and CI adoption contract is maintained internally.

## Crate Groups

| Group | Crates |
|---|---|
| Core protocol | `noren-types`, `noren-ipc`, `noren-manifest` |
| Control plane | `norend`, `noren`, `noren-sdk`, `noren-router`, `noren-runtime` |
| Trust and policy | `noren-identity`, `noren-attestation`, `noren-evm-signer`, `noren-permissions`, `noren-peer-auth`, `noren-audit`, `noren-budget` |
| State and tools | `noren-memory`, `noren-tools`, `noren-llm`, `noren-mcp`, `noren-a2a`, `noren-acedata` |
| Compositor | `noren-tui` |
| Payments | `noren-x402`, `noren-loofta` |
| Settlement | `noren-settlement` |
| Adapters | `noren-timeline-adapter` |
| Multichain (Base/EVM, Robinhood Chain) | `noren-x402-signer-evm`, `noren-evm-firewall`, `noren-rwa-firewall`, `noren-spend-permission` |
| Trading venues | `noren-robinhood` |
| Data provenance | `noren-myrad` |
| Enclaves | `noren-tee` |
| Bonded operators | `noren-bond` |

## Operating Model

The daemon is the enforcement boundary. Agents, web clients, and CLI calls should not bypass it for privileged state. New behavior should preserve these invariants:

- authenticate before serving privileged requests;
- check capabilities before dispatching or mutating protected state;
- record audit rows for important state transitions and rejections;
- keep the audit hash-chain sidecar consistent when audit retention rewrites retained rows;
- keep token bytes, private keys, and secrets out of logs and responses;
- add tests for both success and failure paths when changing protocol behavior.
