# Noren

An operating layer that agents can be held to.

Every agent runs under a signed grant. Every action leaves a receipt in a hash-chained audit log. Code an agent writes runs in an isolated workspace, and paid API calls settle over x402 on Robinhood Chain.

- **Web:** https://usenoren.xyz
- **Docs:** https://docs.usenoren.xyz
- **Sandbox (public, resets every 12 hours):** https://sandbox.usenoren.xyz
- **x402 gateway and facilitator:** https://gateway.usenoren.xyz

<!-- METRICS:START -->
**Status.** Local control plane is real and live-tested (38 Rust crates, ~245k lines, 3334 source-discovered Rust tests including 456 live boundary tests). Production-grade sandboxing for hostile agent code and networked multi-peer operation are roadmap; payments settle in USDG on Robinhood Chain, while on-chain staking and credit metering are not built. See [BUILT.md](./BUILT.md) for the explicit honesty boundary.
<!-- METRICS:END -->

## What works today

| Area | Status | How it was checked |
|---|---|---|
| Capability-scoped actions and an append-only, hash-chained audit log | Live | the sandbox verifies its own chain; `valid: true` |
| Isolated workspace (gVisor, no network, no host files, no inherited secrets, 1 CPU / 128 MB / 8 MB disk / 10 s) | Live | adversarial runs through the real daemon (fork, memory, disk, loop, network, host-path attacks contained) |
| Code agent: writes Python and small websites, runs its own tests, repairs failures (up to 4 rounds) | Live | real-model runs; the website preview is an iframe with a locked-down CSP |
| x402 paid API gateway and facilitator on Robinhood Chain (USDG) | Live | a real 0.01 USDG payment settled on-chain; replay rejected |
| Solidity contracts (escrow, verifier, guard) | Built and tested, **not deployed** as Noren | 89 Foundry tests; the escrow deployment rehearsed on a fork of the live chain |
| Noren token, staking, treasury, settlement | **Not built** | nothing in this repository |

## Run it locally

From the repository root:

```bash
cd agent-os && cargo build --workspace --exclude noren-settlement-program --locked

# register the example agent (the daemon loads $NOREN_HOME/agents/ at startup)
mkdir -p ~/.noren/agents && cp -R ../examples/hello-agent ~/.noren/agents/hello

./target/debug/norend &
./target/debug/noren capabilities grant memory.write
./target/debug/noren capabilities grant intent.subscribe
./target/debug/noren intent "say hello"
./target/debug/noren audit verify
```

The daemon and command-line binaries keep their original names (`norend`, `noren`) and the `NOREN_*` environment variables, so existing setups do not break. Console:

```bash
cd agent-os/noren-web && pnpm install && pnpm dev
```

## Layout

| Path | Contents |
|---|---|
| `agent-os/` | Rust daemon, runtime, audit, permissions, memory, the code agent, and the operator console |
| `agent-os/evm/` | Solidity contracts, tests and the on-chain readiness notes (`NOREN-ONCHAIN.md`) |
| `landing/` | The public site and documentation |
| `deploy/` | Workspace images and the operations files (`deploy/ops/`) |
| `docs/` | Design notes; `NOREN-SDD.md` is the current status document |

## Security

- `scripts/noren-security-gate.py` runs on every commit (`git config core.hooksPath .githooks`). It blocks committed secrets and unreviewed dangerous patterns.
- Report a vulnerability through `/.well-known/security.txt` on the site.
- The sandbox never lets a caller choose an image, command, runtime, mount, environment variable or limit.

## Honest limits

- The public sandbox is a demo. Its state resets every 12 hours; the audit chain is archived before each reset.
- The code agent uses a hosted language model. Passing tests do not prove its documentation is accurate.
- Contracts are not deployed under Noren yet, and no token exists.

## Credits and licence

Noren is released under the Apache License 2.0 (see `LICENSE`). It is built on the open-source Noren project, Copyright 2026 Noren contributors, also Apache-2.0; see `NOTICE.md`.
