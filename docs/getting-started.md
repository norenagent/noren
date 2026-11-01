# Getting started

From zero to your first task in five steps.

## Prerequisites

| Tool | Version |
|------|---------|
| Rust | stable |
| Node.js | 22+ |
| pnpm | 10+ |
| Foundry (optional, for the EVM contracts) | latest |

## 1. Clone

```bash
git clone https://github.com/norenagent/noren.git
cd noren
```

## 2. Build the daemon and CLI

```bash
cd agent-os
cargo build --workspace --exclude noren-settlement-program --release --locked
```

The two binaries land at `target/release/norend` (daemon) and `target/release/noren` (CLI). State lives under `$NOREN_HOME` (default `$HOME/.noren`).

## 3. Install the example agent

```bash
mkdir -p ~/.noren/agents
cp -R ../examples/hello-agent ~/.noren/agents/hello
```

## 4. Start the daemon

In one terminal:

```bash
./target/release/norend
```

## 5. Bootstrap and run your first task

In another terminal:

```bash
./target/release/noren bootstrap
./target/release/noren intent "say hello"
```

`bootstrap` grants the capabilities every loaded agent needs to handle a task. After it runs, `intent` dispatches through the agent and prints the result.

## Verify what happened

```bash
./target/release/noren audit recent -n 5
./target/release/noren audit verify
```

The audit log is a locally hash-chained record of every step. `audit verify` walks the chain and reports any tampering.

## Run the test suite

```bash
bash agent-os/scripts/validate.sh --scripts
bash agent-os/scripts/validate.sh --quick
bash agent-os/scripts/validate.sh
```

Tests prefixed `live_` exercise real backends (real network, real subprocesses, real model). They are `#[ignore]`'d to keep the default run fast. Opt in with:

```bash
cargo test --workspace --exclude noren-settlement-program -- --ignored live_
```

## Build the EVM contracts (optional)

```bash
cd agent-os/evm && forge build
```

## Run the landing site locally

```bash
cd ..
pnpm --dir landing install --frozen-lockfile --ignore-workspace
pnpm --dir landing dev
```

Visit http://localhost:3001.

## Where to look next

- [`docs/demo.md`](./demo.md): one task end-to-end with every audit artifact called out
- [`docs/agent-quickstart.md`](./agent-quickstart.md): from zero to a running, capability-scoped agent with the SDK
- [`docs/agent-sdk.md`](./agent-sdk.md): build an agent in Rust with the `noren-sdk` client
- [`README.md`](../README.md): project overview
- [`CONTRIBUTING.md`](../CONTRIBUTING.md): contribution guide
- [`SECURITY.md`](../SECURITY.md): responsible disclosure
- [`ROADMAP.md`](../ROADMAP.md): what's in flight
