# Witness Loop v0.2 — Architecture Overview

The Witness Loop is Noren's substrate for verifiable autonomous engineering. This doc onboards engineers (human or agent) to its shape. The full plan lives outside the repo at `~/noren-witness-loop-plan-v0.2.md`; this is the durable, in-tree summary that survives plan revisions.

## The bet

The next era of autonomous engineering is won by the substrate that makes autonomous work CRYPTOGRAPHICALLY VERIFIABLE, ADVERSARIALLY REFUTED by independently-keyed processes, ANCHORED on a settlement layer anyone can read, and visibly EVOLVING under a constitutional surface restriction the agent cannot rewrite. "An autonomous agent did this" becomes a checkable cert.

## Three concentric rings

### Ring 1 — Triple-Anchor Witness

Every Noren-author commit is signed by:
- **Anchor 1: Robinhood Chain commit memo** (design). Per-commit zero-value transaction on Robinhood Chain (4663) carrying calldata payload `noren-commit-v1:<sha>:<audit_root_hex>:<unix_ms>`, signed by the operator key (multisig at v0.3). Verification: find the transaction by sender address that references this sha and confirm the signature and finality. No Sigstore Fulcio OIDC dependency; trust root is the operator key.
- **Anchor 2: Local hash chain.** Per-commit `Step` records (model + tokens + durations + trace_id, schema lifted from Letta StepManager) Merkle-rooted into a per-commit `audit_root_hex`. Stored as `attestations/<sha>.json` next to the commit. The same `audit_root_hex` is the second field of the Anchor 1 memo payload, so Anchors 1 and 2 are cryptographically linked.
- **Anchor 3: Batched Merkle-root anchor** (design). Merkle root of N commits batched and posted on Robinhood Chain. Anchor 1 is per-commit (cheap, immediate); Anchor 3 is batched (Merkle root over many commits, stronger structural witness).
- **Anchor 4: Separately-keyed Verifier-Refuter signature.** Independent ed25519 key at `$NOREN_HOME/identity-verifier/local.key` (loaded via `noren_identity::LocalIdentity::load_or_create`), separate launchd job (`org.noren.verifier`), separate Anthropic API quota. Verifier signs ONLY if all five mechanical lenses accept.

Per-commit Merkle leaf format:
```
leaf = sha256(commit_sha || audit_root_hex || verifier_verdict_hash || transcript_cid)
```

Batches anchor every ~10 commits OR 15 min, whichever first.

### Ring 2 — Constrained-Surface Self-Improvement

The Modifier persona's writes are gated by `noren_permissions::scaffold_mutation_scope` (new namespace, Spike 9 verified ≤3 days work). Allowed paths:
- `agent-os/agents/tools/**`
- `agent-os/autonomy/tasks/**`

Modifier can synthesize new tools and new task templates. It CANNOT touch supervisor scripts, verifier code, the constitution, or `/verify`/api routes.

Recovery is a pure-functional 4-state machine (lifted from letta-code's turn-recovery-policy):
- `resolve_approval_pending` — pause for human signal
- `retry_conversation_busy` — backoff + reissue
- `retry_transient` — wait for transient (rate limit, RPC blip) to clear
- `rethrow` — hard fail, escalate to sprint-end

Playbook stored as Letta ToolRule DSL in `agent-os/autonomy/playbook.rules.toml` (replaces prose `PLAYBOOK.md` over time). Self-improvement = sleeptime reflector (separate launchd `com.noren.reflector`) edits rules. Modifier doesn't edit its own gate.

Pre-run checkpoint (lifted from deer-flow `_rollback_to_pre_run_checkpoint`):
```
agent-os/autonomy/checkpoints/<run_id>.json = {
  head_sha,
  porcelain_hash,
  events_jsonl_byte_offset
}
```

Loop-detection (lifted from deer-flow LoopDetectionMiddleware): MD5(tool_name, args) at 3/5 threshold + per-tool freq at 30/50. Soft warn injects reminder; hard strip rolls back via checkpoint.

### Ring 3 — Public verifiable witness (retired plan)

The former Noren witness UI and its per-commit `/verify/[sha]` surface were retired during the Noren rebrand because their public backing data and chain claims are not active Noren services. The surviving `/verify` page is an honest holding surface; the API detail route returns `not_available_yet`.

Keep this section as design history only. Do not publish a witness, lineage, or verifier-circle claim until Noren has a deployed verifier, durable public evidence, and a complete verification path.

## Memory layer (three-tier per Letta naming)

- **Recall (already exists):** `agent-os/autonomy/events.jsonl` — append-only transition ledger
- **Core (new):** `agent-os/autonomy/blocks/playbook.md`, `blocks/lessons.md` — Letta block model, git-backed, auto-anchored by rcommit + cosign
- **Archival (new):** `noren-memory/index/` — sqlite-vec + tantivy fts5, 9-step hybrid retrieval (semantic + BM25 + entity boost) with RRF + sigmoid-attenuation scoring (lifted from mem0)

Fact extraction: mem0 ADDITIVE_EXTRACTION_PROMPT v3, single LLM call per sprint, ADD-only with `linked_memory_ids[]`, md5-hash dedup, UUID→int anti-hallucination remap. Lands in `facts.jsonl` + sqlite-vec index.

Sleeptime reflector (separate launchd `com.noren.reflector`) runs every N sprints, emits CRUD ops over `blocks/`.

## Hard rules baked into ConstitutionVerifier

Anchored on-chain per `docs/provenance/constitution-anchoring.md` (Spike 12: Memo program v0.2):
- Identity-token regex (banned strings never appear)
- Autonomous-author check (`Noren <noren@users.noreply.github.com>` for autonomous commits)
- `scaffold_mutation_scope` path allowlist
- No supervisor/handover/launchd-plist modification
- No centralized-API additions
- No test deletion (extend OK; remove or weaken: reject)

## Skipped / explicitly out of scope for v0.2

- Cross-family verifier as DEFAULT (Spike 8 confirmed OpenAI route viable, but the v0.2 ship treats cross-family as fallback per investor stress-test; OpenAI primary cross-family in Week 4 if shadow mode is clean Week 3)
- ZK proofs of computation (v0.3 roadmap card)
- TEE attestation (v0.3+ roadmap card)
- Bundle-format browser-side cosign (Path 2 in Spike 7; v0.2.x)
- Decentralized constitution governance (v0.4)

## Decentralization roadmap

- **v0.2 (launch):** operator key keystone for constitution + upgrade authority
- **v0.3.0 (week 10):** 2-of-3 multisig replaces the operator key
- **v0.4:** decentralized constitution governance (unspecified, not built)

## Where to look

- Plan (full, ships local): `~/noren-witness-loop-plan-v0.2.md`
- Mining steal list (ships local): `~/noren-witness-loop-steal-list-v0.2.md`
- Day 0 spike log (append-only): `~/noren-day-0-spike-log.md`
- This overview: `docs/provenance/witness-loop-overview.md`
- Constitution anchor: `docs/provenance/constitution-anchoring.md`
- Mutants nightly: `docs/provenance/noren-mutants-nightly.md`
- Noren verification holding page: `landing/app/verify/page.tsx`
- Future verification API placeholder: `landing/app/api/verify/[sha]/route.ts`
