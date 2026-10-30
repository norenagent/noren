# AceData integration — Attested Generative Capabilities

Status: phases 1–3 shipped (provider + provenance + governance + on-chain-by-construction)
Branch: merged to main
Crate: `agent-os/crates/noren-acedata`

## Summary

Wire [AceData Cloud](https://acedata.cloud) — a unified gateway to 50+ generative AI
services (image, video, music, TTS, search, LLM) — into Noren as a first-class
**capability provider**. The value Noren adds is not tool access; it is the
**governance wrapper**: every generation an agent performs through AceData is
capability-scoped, budget-bounded, recorded in the hash-chained audit log, and
optionally anchored on-chain. The output is *verifiable AI generation* — a provable
record of **who** generated **what**, with **which model**, under **whose authority**,
at **what cost**, with a **content hash** — that neither party produces alone.

AceData is the capability layer. Noren is the trust layer. They compose; they do
not overlap.

## Why this, and why it does not conflict

Noren already occupies a clear set of integration surfaces. The naive AceData
integration — "add AceData as another x402 paid-HTTP provider" — would collide head-on
with two of them and add nothing differentiated. We deliberately avoid that.

| Surface | Owner | This integration |
| --- | --- | --- |
| External attestation bridge | `noren-gitlawb` | complementary; not touched |
| Native MCP tool registry | `noren-mcp` | extended with new tools (its intended use) |
| **Generative AI capability + content provenance** | **— (empty)** | **AceData fills it** |

The new crate sits in the one empty quadrant of the map: outbound generative capability
bound to content provenance. Payment is treated as *orthogonal* — the default path is
AceData's Bearer-token billing, which never touches the x402 surface at all. Crypto
speaks x402 on Robinhood Chain), so even the payment layer composes rather than conflicts.

## Why it is valuable to both sides

- **For Noren:** plays directly to its differentiators (scoped capabilities, hash-chained
  audit, settlement ledger, on-chain anchoring). The integration is mostly *wiring an
  existing-shaped provider into existing-shaped governance* — low technical risk, high
  narrative payoff. It gives Noren a demoable, market-relevant hero feature:
  C2PA-style provenance for AI media, enforced by an agent OS and anchored on-chain.
- **For AceData:** a flagship "trust/provenance" reference that differentiates them from
  X402Guard spend control). They are a partner and have signalled they will build to
  whatever we propose; this gives them a distribution + credibility story.

## Architecture

New crate: `agent-os/crates/noren-acedata/` (deliberately **not** `-x402`; this is a
Bearer-token generative provider, not a new payment surface).

```
noren-acedata/
├── lib.rs         AceDataConfig (api_key, base_url, enabled, model allowlists, budget caps); exports
├── client.rs      async REST client → api.acedata.cloud (Bearer ACEDATACLOUD_API_TOKEN);
│                  task submit + poll (their generation APIs are task-based)
├── catalog.rs     curated tool set + per-tool cost class / input schema
├── tools.rs       impl noren_mcp::Tool per tool; call() → client → provenance record
└── provenance.rs  AceDataGeneration record: grant id, intent id, model, sha256(prompt),
                   output ref + sha256(output), cost, timestamp — shaped for the audit
```

Wiring (points confirmed against current `main` at build time):

- **Tool registry:** extend `tools_vec` at daemon startup (`norend/src/main.rs`), gated by
  `[acedata] enabled` in `secrets.toml`. Tool calls auto-emit audit events — no special path.
- **Capability scope:** add `acedata_generate_scope_allows(scope, model, est_cost)` to
  `noren-permissions`, wired into the dispatch-time `tool_call_scope_allows` path. A grant
  can then say "this agent may call image generation, Flux only, ≤ $2 / session."
- **Audit:** add `AuditKind::AceDataGeneration { intent_id, family, model, prompt_sha256,
  output_ref, output_sha256, cost, settlement_tx }` to `noren-audit`.
- **Settlement:** emit a `SettlementReceipt` per call into `noren-settlement`; surface in
  the web console.
- **On-chain (optional):** route the provenance/audit root through the existing
  certificate. Reuse, not new.
- **Payment (optional):** default is Bearer billing. If an operator wants crypto pay-per-call,

## Curated first tool set

Start narrow and high-signal rather than exposing all 50+ services:

- `acedata.image.generate` — Flux / Midjourney
- `acedata.music.generate` — Suno
- `acedata.search` — Google SERP
- (phase 2) `acedata.video.generate` — Sora / Veo / Kling · `acedata.tts` — Fish · `acedata.chat` — LLM gateway

## Configuration (phase 1)

Off by default. The daemon reads these env vars at startup (the API key is a Bearer billing
credential, kept off-repo — see `.env.example`):

- `NOREN_ACEDATA_ENABLED` — `1` / `true` / `yes` to register the tools
- `NOREN_ACEDATA_API_KEY` — token from the platform.acedata.cloud console (required)
- `NOREN_ACEDATA_BASE_URL` — API host override (default `https://api.acedata.cloud`)
- `NOREN_ACEDATA_ALLOW` — comma-separated tool allowlist (empty = all three)
- `NOREN_ACEDATA_IMAGE_MODEL` / `NOREN_ACEDATA_MUSIC_MODEL` — default models

Tools registered: `acedata.image.generate` (Flux), `acedata.music.generate` (Suno),
`acedata.search` (Google SERP). Each call returns two result blocks — the raw API response,
then a `provenance` record: `{ provider, tool, model, prompt_sha256, output_sha256, assets,
task_id }`. The output hash is taken over the canonical JSON (JCS) of the response; hashing the
asset bytes themselves is a phase-2 refinement. Because the tools register into the daemon's
tool registry, every call is already capability-gated and audited like any other tool — no new
enforcement path was needed for phase 1.

## Phasing

1. **MVP — shipped.** `noren-acedata` crate: Bearer client, 3 flagship tools (image, music,
   search), per-call provenance records, env-gated daemon wiring, unit tests + a live smoke
   example. Governed via the existing tool-registry capability path; audited via the existing
   tool-call trail. No chain.
2. **Provenance surfaced + tightened governance — shipped.** A dedicated
   `AuditKind::AceDataGeneration` event (provenance becomes a first-class, hash-chained row, not a
   generic tool-call), a `acedata_generate_scope_allows` capability predicate (a grant may pin a
   `{"models": [...]}` allowlist), enforced by a per-call model gate in an `acedata.*` daemon
   dispatch branch that also records a `ResourceKind::Tool` settlement receipt — all bound to the
   calling agent. Plus a "Generations" panel in `noren-web` (`/generations`) that reads the
   audit feed and shows model, prompt/output hashes, assets, and task id per generation. Per-call
   cost in the receipt is `0` until AceData returns cost metadata (a partner ask).
   the daemon's `verify_integrity` root). Because every generation is an `AceDataGeneration` event
   on-chain root that covers it.
   - **Per-generation inclusion proof — shipped.** `noren-audit` now exports an
     `AuditInclusionProof` (`AuditLog::prove_inclusion`) and an offline `verify_inclusion_proof`.
     The audit log is a linear SHA-256 hash chain, so a proof carries the generation's exact event
     line, the chain hash before it, and the per-event hashes after it; folding them reproduces the
     anchored root. Fetch it for any generation via `GET /audit/inclusion/:event_id` (operator-only;
     the `/generations` panel shows the event id), and verify it without trusting the daemon via
     `cargo run -p noren-audit --example verify_inclusion -- proof.json`. Then compare
     pay-per-call.
4. **North star (optional):** attested AI-media *resale* — Noren already models resale
   descriptors; an agent-generated asset becomes a verifiably-sourced, tradeable artifact.

## Rejected alternatives

  hatcherlabs; redundant; adds no differentiated value. This is exactly the conflict to avoid.
- **Register AceData's hosted MCP servers as external MCP endpoints (config only):** trivial, but
  it is not really an integration — no capability/audit/settlement leverage, nothing
  Noren-specific, and under-delivers on a partnership. Viable as a convenience add-on, not the core.
- **Skills-only (`npx skills add acedatacloud/skills`):** Noren is a Rust daemon, not a
  SKILL.md host; skills are documentation for the agents the runtime *spawns*, not for the daemon.
  Worth shipping to spawned agents in a later phase, but not the spine of the integration.

## x402 pay-per-call (verified live on mainnet, 2026-06-23)

AceData exposes an optional keyless x402 path alongside credit billing.
Discovery: `GET https://platform.acedata.cloud/.well-known/x402`.

A POST to a billed endpoint without an API key returns HTTP 402 with a
mainline x402 **v2** challenge offering Base and SKALE. The
accept is USDC with **no `extra.feePayer`**, so the caller funds gas
(self-paid scheme).

Payment path: an unpaid request returns a 402 challenge; Noren signs the
payment with the daemon's EVM signer (`noren-x402-signer-evm`, EIP-3009) and
retries with the `X-PAYMENT` header. The response's `cost` block is captured by
the provenance record.
