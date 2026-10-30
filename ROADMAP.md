# Roadmap

Noren is moving toward an open operating layer for governed autonomous software engineering. The roadmap is organized by system capability, not by marketing milestones.

## Foundation: Local Control Plane

The foundation is a local control plane for autonomous engineering systems: daemon, CLI, TUI, IPC/HTTP gateway, identity, capabilities, audit, memory, A2A, MCP, budget, local receipts, provenance envelopes, autonomous workflow records, and live validation paths.

## Multi-Chain Trust Reach

Noren's identity, reputation, provenance, and bond receipts project onto other chains as signed statements, without moving `$NOREN` off Robinhood Chain. Live today on Base mainnet: ERC-8004 agent registration, a deployed bond-receipt verifier and a registered EAS reputation schema, EAS off-chain attestations for audit roots and reputation, and an ENS CCIP-Read gateway (`noren.eth`, `*.agents.noren.eth`) that resolves to the canonical Robinhood Chain identity — each verifiable with a plain `ecrecover`, no bridge. The same rail and stateless verifier design also reach Robinhood Chain mainnet (chain 4663): a generic USDG x402 payment has settled on mainnet in real USDG, and a bounded-spend escrow enforces per-call spend limits and pay-for-passing-output, its charge, release, and refund loop proven on Robinhood Chain testnet; its bond and reputation verifiers are deployed but not yet exercised, and no ERC-8004 identity is projected there. `$NOREN` stays a single Robinhood Chain token. Staking and revenue share are not live.

Not yet production: on-chain reputation scores (the schema is registered but writes stay gated), funded USDC bonds and live slashing (the verifier is deployed but unfunded), the Base outbound-pay path (built, not wired into the default daemon), and trust-minimized cross-chain enforcement (slashing a Robinhood Chain bond from an EVM-proven event). See [docs/multichain-value-capture.md](./docs/multichain-value-capture.md).

## Noren Compute

Noren Compute is a planned network where people and their agents rent GPUs by the second and pay for finished work, settled on Robinhood Chain. What exists today is the sandbox: agent code runs in gVisor with no network and a hash-chained audit log. See [usenoren.xyz/compute](https://usenoren.xyz/compute) and the [compute docs](https://docs.usenoren.xyz/compute).

Not live yet: GPU leases, operator staking, metered escrow, prices, and payouts. There are no leases or operators on the network today.

Planned:

- GPU rental by the second with a meter both the renter and the operator can read, settled on Robinhood Chain once when the session ends.
- Coding agents for hire: one operator's agent changes your repository, a different operator runs your acceptance tests, and you pay only for work that passes.
- Hidden tests that the agent could not read, so the work has to hold up beyond the visible tests.
- Signed verdicts from every operator who checks the work, recorded on Robinhood Chain before anyone is paid.
- Operator staking in NOREN, with part of the stake lost when the network proves a fault. Staking is not live.
- Ordering through MCP tools or the command line, with a spending limit on every call.

## Company

In progress:

- Incorporating Noren as a company.
- Verified Organization status on X, so the gold checkmark shows that [@Noren](https://x.com/Noren) is the official account.

## Now: Harden the Local Control Plane

The current priority is making the local daemon and CLI reliable under real engineering use.

- Keep identity, peer auth, capability checks, audit rows, and token rotation strict.
- Expand live tests across daemon, CLI, HTTP, MCP, A2A, and subprocess boundaries.
- Keep A2A requeue, force-error repair, lease guards, and queue-status semantics covered through live CLI fixtures.
- Improve memory lifecycle: working-tier cleanup, compaction policy, and drift checks.
- Keep local validation and CI equivalent through `agent-os/scripts/validate.sh`.
- Keep public docs aligned with implementation evidence and validation coverage.

## Next: Resumable Autonomous Maintenance

The next layer is a repeatable agentic maintenance loop that can run in bounded cycles.

- Task lifecycle state persisted in a simple inspectable format.
- Handoff artifacts that let a fresh session resume without private chat context.
- Review gates for architecture, security, docs drift, and missing tests.
- Human escalation records for credentials, destructive operations, and production authority.
- Regression hardening from prior failures into guard scripts and tests.
- Project memory conventions for roadmap, status, architecture, and known gaps.

## Then: Stronger Execution and Policy

The runtime needs stronger isolation and clearer policy boundaries before it can host untrusted agents.

- Linux sandboxing with gVisor first; Firecracker remains a later target.
- Per-resource budgets with pause, save, and resume semantics.
- Secret access through daemon-mediated tools instead of direct environment exposure.
- Capability scopes for agent-to-agent send, receive, respond, tool calls, memory writes, and external gateways.
- Operator-visible provenance for every privileged action.

## Later: Networked Agents and Settlement

- Multi-peer operation across authenticated hosts.
- Public provenance through signed artifacts and transparency-log attestation.
- Daemon-driven on-chain settlement and provider-payout escrow on Robinhood Chain. Not built yet; payments today are USDG x402 authorizations. See [BUILT.md](./BUILT.md) for the honesty boundary.
- The agent-to-service payment rail over HTTP 402 (x402) is already operating: the daemon can pay for metered x402 resources outbound. The remaining settlement work is the daemon-driven anchoring of internal resource receipts described above, not the payment rail itself.
- SDKs for agent authors: TypeScript, Python, Rust-crate, and framework-adapter SDKs remain planned.
- Installer and upgrade path for local machines.
- Marketplace and registry infrastructure for authenticated agent networks.

## Research Tracks

- Durable project memory that survives long time horizons without stale context poisoning.
- Verifiable autonomous engineering: signed tasks, signed reviews, and auditable repair loops.
- Policy-aware tool orchestration across MCP, local commands, browsers, and code execution.
- Continuous repair loops that can detect regressions, bisect causes, and propose fixes.
- Human-directed autonomy: humans set strategy and authority boundaries; agents execute and maintain.
