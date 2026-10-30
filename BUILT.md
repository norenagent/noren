# Recursive Engineering Model

Noren is developed with an autonomous engineering loop that mirrors the operating-layer primitives in the codebase. The loop is not presented as full self-improvement, full autonomy, or a benchmarked replacement for maintainers. It is an inspectable process for letting agents perform bounded engineering work while preserving review, provenance, and human authority boundaries.

This file records how the public project relates to that loop. The detailed engineering protocol is maintained internally.

## What Is Real Today

The repository already contains concrete substrate for agentic operation:

| # | Primitive | Repository implementation | Workflow use |
|---|---|---|---|
| 1 | Intent | Daemon dispatch + router, shaped in `noren-types` and `noren-router` | Natural-language requests route to agents, tools, and workflows over typed shapes. |
| 2 | Runtime | `noren-runtime` | Agents run as bounded trusted-local subprocesses; an opt-in Linux gVisor runner is selectable with ignored live coverage gated on `runsc` and an explicit rootfs. |
| 3 | Memory | `noren-memory` | Project state is persisted across working, episodic, and long-term tiers. |
| 4 | Identity | `noren-identity` and peer auth | Local sessions and commits can be tied to scoped identities. |
| 5 | Permissions | `noren-permissions` | Security-sensitive operations are expected to pass capability and review gates. |
| 6 | Comms | `noren-ipc`, `norend` HTTP gateway, `noren-mcp`, `noren-a2a` | Tool and peer boundaries are explicit, not implicit process sharing. |
| 7 | Compositor | `agent-os/noren-web` Next.js console and `noren-tui` terminal binary | Operator-facing surface for agent state, decisions, and audit; the TUI renders intent, memory, audit, capabilities, A2A, chain-receipts, and peer-registry views over the daemon IPC. |
| 8 | Settlement | `noren-settlement`, plus USDG payments on Robinhood Chain through `noren-x402` | Resource accounting exists locally, including rollback-backed receipt backfill primitives. Payments settle in USDG on Robinhood Chain (EIP-3009). There is no on-chain credits, staking, or slashing contract; the daemon-driven anchoring of internal resource receipts is not production. |

Audit (`noren-audit`) is a cross-cutting accountability layer underlying Identity, Permissions, and Settlement — append-only JSONL events, local hash-chain integrity reports, retention controls, signed actions, and audit-root attestations.

The agent-to-service payment rail over HTTP 402 (x402) is live today and is distinct from the internal-receipt settlement above: the daemon can pay for metered x402 resources outbound, and Noren operates a deployed x402 seller that settles in USDG on Robinhood Chain mainnet — selling Noren-Verified attestations, on-chain identity passports, and reputation reads, with the seller's signing key published at `/.well-known/x402` — alongside a bounded-spend escrow service. What is *not* production is the daemon-driven on-chain anchoring of internal resource receipts; the payment rail being live does not change that boundary.

Noren's trust layer also reaches Base mainnet (chain 8453) without moving the token: the foundation agent is registered under ERC-8004 (Identity Registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, agent id 58403), a bond-receipt verifier (`0xBee387DD4A2fF215d6f997E5DA464C92285BCb6e`, `ecrecover`-based, native-USDC-denominated) and an EAS reputation schema are deployed, audit roots and reputation are re-expressed as EAS off-chain attestations signed by a cold secp256k1 issuer (`0x186953d5b4A290f8f53b8377cb38EDA75D664211`) bound to the Robinhood Chain identity, and agents resolve through a live ENS CCIP-Read gateway (`noren.eth`, `*.agents.noren.eth` resolving to the Robinhood Chain identity, served from `ens-gateway.usenoren.xyz`). Each artifact is verifiable with one `ecrecover`, no bridge. `$CVNT` stays a single Robinhood Chain mint, every per-call fee and bond is chain-local USDC, and a build-time quarantine guard fails CI if the mint or a bridge primitive leaks into a cross-chain crate. A Base x402 seller is live as well, settling USDC on Base mainnet over EIP-3009 for Noren-signed attestations. What is *not* yet exercised on Base: no reputation score has been written on-chain (the EAS schema is registered but writes stay gated), no USDC bond has been funded or slashed (the verifier is deployed but unfunded), the Base outbound-pay path is built but not wired into the default daemon, and trust-minimized cross-chain enforcement (slashing a Robinhood Chain bond from an EVM-proven event) is unbuilt.

The same stateless verifier design reaches a second EVM chain, Robinhood Chain mainnet (chain 4663). The bond-receipt verifier and a chain-agnostic reputation verifier are deployed there against the same canonical Robinhood Chain attestor, denominated in USDG (Global Dollar). A generic USDG x402 payment has settled on 4663 mainnet over EIP-3009, using the same `noren-x402` signer that settles USDC on Base. A `SpendGrantEscrow` contract enforces bounded agent spend against an on-chain grant: a total budget, a per-call ceiling, a provider allowlist, an expiry, and attested release or full refund. Its charge, spec-gated release, and refund loop is proven on Robinhood Chain testnet, driven end to end by norend itself, and stays off in production until an operator arms it. Robinhood Chain carries no ERC-8004 identity projection, since the canonical registry is not deployed there and identity stays Robinhood Chain-canonical, and, as on Base, no bond is funded and no reputation score is written on-chain there yet.

The loop also has practical enforcement:

- a tracked pre-commit hook for one-session-per-checkout protection;
- a validation script used by local development and CI;
- guard scripts for known regression classes;
- a test convention that separates mock tests from opt-in `live_` tests;
- explicit human escalation rules for credentials, production deployment, legal decisions, and destructive operations.

## Engineering Cycle

Each autonomous cycle should be small enough to review and large enough to move a real system boundary. The cycle is:

1. Inspect repository state and prior handoff notes.
2. Define the next bounded task and its expected production failure modes.
3. Plan the implementation before editing.
4. Implement the change.
5. Run self-review against correctness, scope, style, and security impact.
6. Trigger cross-review or security review when the gates require it.
7. Run validation and repair failures.
8. Update docs, status, and project memory.
9. Integrate the change with a human-readable commit history.
10. Hand off enough context for a fresh agent session to resume.

The lifecycle is intentionally conservative. A change is not complete because code was generated. It is complete when the behavior is implemented, validated, reviewed at the appropriate level, and documented where the public contract changed.

## Review Gates

The tracked workflow defines six gates:

| Gate | Trigger | Required outcome |
|---|---|---|
| Plan gate | More than one credible architecture path | Record the chosen design and rejected alternatives. |
| Security gate | Identity, permissions, audit, settlement, secrets, or sandbox boundaries changed | Security review before integration. |
| Fan-out gate | Broad cross-crate or cross-app changes | Split ownership by module or reduce scope. |
| Test-expansion gate | New public behavior with shallow tests | Add failure-mode coverage or record the gap. |
| Docs gate | Public terminology, commands, or architecture changed | Update public docs in the same change. |
| Escalation gate | Credentials, destructive operations, legal/business calls, production deploys | Stop that path and continue only with unblocked work. |

These gates are useful only when they create artifacts a future maintainer can inspect. Silent reasoning does not count.

## Provenance

The public model is scoped provenance, not personality. Work should be attributable by domain, task, reviewer, validation command, and commit, without relying on named agent personas or private operator details.

Accepted provenance signals:

- signed commits or signed release artifacts where available;
- CI run links and validation command output;
- structured audit rows for daemon actions;
- review notes for security-sensitive changes;
- status docs that distinguish implemented, experimental, and planned work.

Public keyless attestation has landed for release-subject manifests via sigstore keyless (cosign + Fulcio + Rekor); the remaining work is extending the signing workflow to audit-root attestations and release-scope manifests. Local signing identities (operator-held ed25519 keys for unsigned audit-root attestations) remain separate from this CI-driven keyless path.

## Honesty Boundaries

Noren does not currently claim:

- full autonomous software engineering without human authority;
- production sandbox-grade isolation for arbitrary untrusted agents;
- production multi-peer operation across untrusted hosts;
- the daemon-driven on-chain settlement lifecycle in production (per-intent consume is not yet production; there is no on-chain staking or credits contract);
- the EVM trust layer beyond what is deployed: on Base, on-chain reputation writes (the EAS schema is registered, but no score is attested on-chain yet), funded USDC bonds or live slashing (the bond-receipt verifier is deployed but unfunded), Base-default outbound payments (built, not wired into the default daemon), and trust-minimized cross-chain enforcement; on Robinhood Chain, a funded USDG bond or an on-chain reputation score (both verifiers are deployed but unexercised) and an ERC-8004 identity projection (the canonical registry is not deployed there);
- public benchmarked self-improvement;
- a release-ready installer, or a multi-language SDK ecosystem beyond the published TypeScript `@noren-org/sdk`.

Those are roadmap items. The current system is a working local substrate with strong primitives in some areas and deliberately marked gaps in others.

## Verification

Useful local checks:

```bash
bash agent-os/scripts/validate.sh --quick
bash agent-os/scripts/test-stats.sh
```

The full Rust validation gate is:

```bash
bash agent-os/scripts/validate.sh
```

Live tests are opt-in:

```bash
cd agent-os
cargo test --workspace --exclude noren-settlement-program -- --ignored live_
```
