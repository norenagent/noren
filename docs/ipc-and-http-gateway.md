# IPC and HTTP Gateway

The Noren daemon exposes two transport surfaces for the same protocol:

- IPC framed responses parsed by `noren-ipc`.
- The HTTP gateway exposed by `norend` for `/version`, `/tools/call`, audit, peer, and A2A endpoints.

Protocol metadata is reported through `ProtocolInfo` over IPC, the HTTP `/version` route, and the `noren version` CLI. Compatibility rules and the v1/v2 staging boundary live in [docs/protocol-versioning.md](./protocol-versioning.md). Migration notes live under [docs/protocol-migrations/](./protocol-migrations/README.md). The IPC fixture replay harness pins both transports together so they cannot drift independently.

The decision to bump the protocol to v2 and publish v2 fixtures is human-owned (ADR 0010, integrated 2026-05-18). This document defines the contract every v2 fixture must satisfy so subsequent additions and any future protocol bump are deterministic.

## v2 Fixture Contract

The contract is enforced by an internal validator. The validator runs in two modes against `agent-os/crates/noren-ipc/tests/fixtures/v2/`: dormant when the directory has no `*.v2.json` files, strict when any appear. The rules below govern every v2 fixture and the validator emits a remediation pointer on the first rule that fails.

### File Layout

- v2 response fixtures live under `agent-os/crates/noren-ipc/tests/fixtures/v2/`.
- Each fixture file is named `<envelope>.v2.json` where `<envelope>` is a kebab-case identifier for the envelope variant (e.g., `stream-envelope-begin.v2.json` pins `StreamEnvelope::StreamBegin`). Distinct case shapes of the same envelope may use a suffix (e.g., `stream-envelope-end-with-summary.v2.json` for the SubmitIntent rollup case).
- When an envelope exists in both v1 and v2 (a response variant whose wire shape gained an additive or alternative form), the `*.v2.json` file reuses the base name of its `*.v1.json` sibling so the version diff is obvious. Envelopes that are v2-only (the four `StreamEnvelope` variants today) have no `*.v1.json` sibling and the rule does not apply.
- v1 fixtures stay at the root of `agent-os/crates/noren-ipc/tests/fixtures/` until v1 support is intentionally removed.
- The `tests/fixtures/v2/` directory remains a staging boundary; non-fixture files (such as the staging `README.md`) must not match the `*.v2.json` glob.

### Schema-version Field

- A v2 fixture whose envelope carries a stable version key (e.g., `protocol_info` exposes `info.version`) must declare that field as `2`. The file suffix (`*.v2.json`) and the payload version must agree where a version slot exists.
- The validator rejects such a fixture if its declared version field is not `2`. Whitespace variation around the colon is tolerated.
- Envelope-shape wire frames that have no natural version slot (e.g., `StreamEnvelope` variants such as `stream_begin`, `stream_chunk`, `stream_end`, `stream_error`) are exempt: their v2 binding is the staging directory location, the `*.v2.json` file suffix, and the migration-note pairing rule below. Adding a synthetic version field to those frames would diverge from the wire bytes they pin.

### Migration-note Pairing

- [docs/protocol-migrations/v2.md](./protocol-migrations/README.md) is the canonical migration record for the v2 promotion. It uses the format from the migration-notes README (compatibility window, breaking changes, affected IPC and HTTP surfaces, fixture files added, expected client behavior).
- Each `*.v2.json` filename must be referenced by name inside `docs/protocol-migrations/v2.md`. The validator rejects fixtures that are not bound to the migration note, both for the existing fixture set and for any new addition.
- A new v2 fixture and its migration-note bullet must land in the same commit.

### Validator Behavior

- Dormant: when the `tests/fixtures/v2/` directory has no `*.v2.json` files, the validator prints a "dormant (no v2 fixtures present)" line and exits 0.
- Strict: when any `*.v2.json` file appears, the validator fails fast with a remediation message if the file layout, schema-version field, or migration-note pairing rule is violated.
- The validator does not write fixtures, modify migration notes, or change protocol constants.

## Query Parameters

Read-side HTTP routes accept optional query parameters that mirror the corresponding IPC request fields:

- `GET /peers/list?status=live` and `GET /peers/list?status=revoked` narrow the response to live or tombstoned peer entries respectively. Omitting `status` returns the full registry (live plus revoked, including the operator's own row). The query layer uses untyped strings and degrades a typo (or any unrecognised value) to "no filter" rather than rejecting the request, matching the rest of the read-side filter surface. `limit` and `prefix` compose conjunctively with `status`. The `noren peers list --json` CLI wraps the same response in a stable envelope with `kind: "peer_list"`, `filter_pubkey_prefix` (echoes the request value or `null`), `matched_count` (rows in `peers` — equals the exhaustive match count when `truncated` is `false`), `operator_pubkey_b58`, and `truncated` (set when the registry held more matches than `limit`).
- `GET /a2a/queue` accepts `limit`, `min_lease_age_ms`, `deadline_within_ms`, and `state_filter=queued|in_flight`. Each filter is applied before the limit truncation so a noisy filtered-out cluster cannot push matching rows out of the result window. The JSON envelope echoes the active filters back to the caller so machine consumers can distinguish a state-only result from a pre-filter empty result.
- `GET /audit/recent` accepts `limit` and `since_ms=<epoch_ms>`. `since_ms` drops audit events whose `timestamp_ms` is strictly less than the threshold and is applied before `limit` so a recent burst cannot push older-but-still-in-window events out of the truncation slice. The CLI flag `--since-ms <epoch_ms>` and IPC `Request::RecentAudit.since_ms` carry the same semantics; the JSON envelope echoes the active threshold back as `since_ms`.
- `GET /receipts/recent` accepts `limit` and `since_ms=<epoch_ms>`. `since_ms` drops settlement receipts whose `settled_at` is strictly less than the threshold, applied before `limit` so a recent burst cannot push older-but-still-in-window receipts out of the truncation slice. The CLI flag `--since-ms <epoch_ms>` and IPC `Request::RecentReceipts.since_ms` carry the same semantics; the `noren receipts recent --json` envelope echoes the active threshold back as `since_ms`.

## Provenance Query

IPC `Request::QueryProvenance` is the operator-visible provenance view: it returns every privileged action in a window, projected from the capability family of audit kinds (`CapabilityCheck`, `CapabilityGranted`, `CapabilityGrantRejected`, `CapabilityRevoked`, `CapabilityScopeRejected`, `CapabilityRevokeRejected`) into uniform `PrivilegedAction` rows answering "who acted, under which signed rule, who approved it, and how it resolved". It is gated on the **operator identity** (mirroring `Request::VerifyAuditIntegrity`), not scoped to the caller's own audit feed, because the response carries the global hash-chain verdict and a cross-actor view. Non-operator callers receive `Response::Error`.

The daemon verifies the audit hash-chain in the same call and returns the verdict as `Response::ProvenanceActions.integrity` (an `AuditIntegrityReport`), so a provenance answer is always chain-backed and can never silently read tampered rows. `scanned` reports how many in-window events were examined, making the cost and coverage of the answer visible.

Filters compose conjunctively: `since_ms`/`until_ms` bound the window inclusively (absent ends stay open); `actor`, `approver`, and `outcome` are exact matches; `rule` matches a base58 signature prefix so an operator can paste a short fragment from an audit row. `limit` bounds the result to the most recent matching rows in chronological order (defaulting to `default_recent_limit`), keeping a large audit log from streaming an unbounded result. Each `PrivilegedAction` carries `event_id`, `timestamp_ms`, `kind`, `actor`, `action`, `approver`, `rule`, and `outcome`, where `outcome` is one of `authorized`, `denied`, `granted`, `grant_rejected`, `revoked`, `revoke_noop`, `scope_rejected`, or `revoke_rejected`. This iteration exposes the query over IPC only; there is no HTTP route or CLI verb yet.

## Mutation Routes

Write-side HTTP routes forward to the same `Server::respond` handler as their IPC request, so the capability check is identical across both transports — neither can under-check the other.

- `POST /settlement/receipts/backfill` maps to IPC `Request::BackfillSettlementReceipts { dry_run, scope_pubkey }`. The JSON body carries the same two fields, both optional (a missing `dry_run` is `false`). `scope_pubkey` is reserved for a future delegated mode and is not yet supported: any request that sets it is rejected before the capability check, since the operation evaluates the authenticated operator's own grants. The handler gates on the `settlement.backfill.*` capability (apply vs dry-run, see [docs/capabilities.md](./capabilities.md)) before repairing legacy receipt rows. The `noren settlement backfill-receipts --json` CLI wraps the result in a stable envelope `{"schema":"noren.settlement.backfill.v1", ...}` carrying `row_count`, `rollback_path`, and `dry_run`.
- `POST /memory/records/backfill` maps to IPC `Request::BackfillMemoryRecords { dry_run, scope_pubkey }`. Same two-field optional body shape, same delegated-mode rejection on `scope_pubkey`. The handler gates on `memory.backfill.*` (apply vs dry-run, see [docs/capabilities.md](./capabilities.md)) and requires the operator identity before merging `metadata.receipt_id` onto legacy memory rows. Correlations are recomputed server-side from the operator's own memory and receipt rows via `noren_memory::memory_receipt_backfill_correlations`; clients cannot supply correlations directly. The `noren memory backfill-receipt-correlation --json` CLI wraps the result in a stable envelope `{"schema":"noren.memory.backfill.v1", ...}` carrying `row_count`, `savepoint_name`, and `dry_run`.
- `POST /identity/sign` maps to IPC `Request::SignAttestation { message_b58, ts }`. The handler (`sign_attestation`) gates on the `identity.attest` capability (see [docs/capabilities.md](./capabilities.md)), enforces a timestamp-freshness window, bounds the base58 message, then signs the domain-separated preimage `b"noren.identity.attest.v1\n" || message` with the daemon's own ed25519 identity, returning `Response::IdentityAttestation { signature_b58, pubkey_b58, ts }` (`kind: "identity_attestation"`). Because the daemon self-signs with `self.identity`, the receipt is verifiable offline against the daemon pubkey: `live_http_identity_sign.rs` drives the route over the gateway, asserts the bearer gate, then verifies the returned signature byte-exact against a local re-sign of the preimage — RFC 8032 ed25519 is deterministic, so a dropped domain prefix or a wrong signing key fails the equality even though the envelope stays well-formed.
- `POST /peers/revoke` maps to IPC `Request::RevokePeer { token_prefix, force, match_limit }` (the JSON body's `force` and `match_limit` default to `false`/absent). Revoking a peer is the lever that cuts off a compromised agent; it is authorized by operator identity, not a separate grant. On success the response is `{"kind": "peer_revoked", "outcome": {"type": "revoked", "token_prefix": <6-char>, "agent_id": {...}, "revoked_at": <ms>}}`; the `token_prefix` echo is the truncated prefix, never the full token. Because `require_bearer` resolves the bearer through the peer registry before the handler runs, a revoked token stops authenticating immediately: `live_http_peers_revoke.rs` seeds a guest peer, confirms its bearer reaches a `200`, revokes it, and confirms the same bearer is then rejected `401` — the `200 -> 401` flip proving the revoke deactivated the token rather than merely returning a well-formed receipt.

## Cross-host A2A Admission

`POST /a2a/peer-tasks` is the receiving daemon's inbound surface for cross-host A2A (multi-host slice 4b-2b). It is the one mutation route **exempt from the `require_bearer` gate**, and for a different reason than `/health` and `/version`: a daemon on another host holds no local peer token, so it authenticates by an ed25519 signature over the task envelope (`noren_a2a::SignedA2ATask`, slice 4b-1) instead of a bearer. The route lives in its own axum router group with no auth layer, so the exemption is structurally confined and cannot reach any protected route; `http_gateway.rs` asserts a missing bearer still `401`s every other route while this one admits.

The body is parsed into a `SignedA2ATask` and handed to `Server::admit_remote_a2a_task(envelope, epoch_ms())`, which runs the fail-closed admission pipeline (open → known-hosts authorization → recipient-is-self → freshness → recv-gate → restart-durable replay claim → enqueue). The route adds three transport-level properties:

- **Dedicated body cap.** The exempt group carries its own `DefaultBodyLimit` of 64 KiB — far tighter than the 8 MiB `MAX_FRAME` the bearer-gated routes use — because deserialization precedes signature verification on this unauthenticated surface, so the cap bounds an attacker's pre-auth allocation. A body over the cap is `413`d before admission runs.
- **One non-leaking outcome per class.** `RemoteAdmission::{Admitted, Duplicate}` both map to `202 {"kind":"accepted"}` and `RemoteAdmission::Rejected` maps to one `403 {"kind":"rejected"}`, identical for every rejection cause (bad signature, unknown principal, stale, recv-not-granted, …). The rejection stage is observable only on the operator audit feed (`AuditKind::CrossHostA2AAdmission`), never on the wire, so the route cannot be turned into a probing oracle. A replay is absorbed idempotently — the second `POST` of the same envelope returns the same `202` and does not enqueue a second copy.
- **Real receiver clock.** The handler supplies `epoch_ms()` so the freshness window actually fires against wall time; a stale envelope is rejected over HTTP exactly as the unit pipeline rejects it.

Two accountability/authorization properties are enforced in the admission core and exercised through this route: an **admitted (or duplicate) decision is persisted durably before the task reaches the mailbox** and the admission fails closed (returns `Rejected`, enqueues nothing) if that audit write fails, so a delivered task can never lack an attributable record; and the recv-gate requires the **pubkey-b58 grant form** `a2a.recv.<sender_pubkey_b58>`, not the sender-controllable display form, since only the pubkey is registry-bound. The presented host is derived solely from the signed `task.sender.display` and matched byte-exact against the known-hosts registry — never from the request's `Host` header, URL authority, or TLS SNI — so no case-insensitive transport source can split or confuse host identity.

The daemon stays loopback-bound; reaching a remote sender requires an operator-gated bind change that is out of scope here. Per-route rate-limiting is deferred to the ingress/reverse-proxy layer that terminates external connections rather than an in-process limiter (which, on loopback, would key on the proxy socket and be ineffective); the residual response-timing side-channel is tracked for the bind-change slice.

## Cross-host A2A Delivery

`POST /a2a/peer-tasks` (above) is the *receiving* daemon's surface; the *sending* daemon reaches it from `Server::send_a2a_task` (multi-host slice 4b-3). Once an A2A send clears the `a2a.send` capability gate, the recipient's host is resolved in the known-hosts registry: a host absent from the registry is local and queues to the local mailbox unchanged, while a host present in it is **remote** and is delivered over the network by `Server::deliver_cross_host` rather than queued locally. That check sits after the capability gate (an unauthorized caller learns nothing about registry membership) and before the recv-admission gate (a remote recipient is never evaluated against local recv grants it cannot hold).

Delivery is daemon-to-daemon. The sending daemon seals the task into a `SignedA2ATask` (slice 4b-1) under **its own** ed25519 identity, so the wire sender is provably this daemon — the principal the receiver's known-hosts registry binds to this host. A task whose logical sender is a different local peer is refused rather than vouch-sealed (`sender_not_self`), since signing it as the daemon would misattribute it on the remote's feed; in v0 a cross-host send therefore originates from the daemon's own identity. Before sealing, the recipient's key is checked byte-exact against the known-hosts binding for its host (the `verify_remote_identity` binding, against the endpoint already resolved for routing): a recipient key that is not the bound identity is refused (`identity_mismatch`) before any envelope reaches the wire, so the daemon never delivers to an endpoint answering under a key the operator did not bind.

The sealed envelope is POSTed to `<endpoint.url>/a2a/peer-tasks` with a per-call client bounded by a request timeout, so a silent or dead remote cannot stall dispatch. Outcomes map to a `Response` and a best-effort `AuditKind::CrossHostA2ADelivery` row (issuer = the sending daemon):

- **202** → `Response::A2ATaskQueued` (the remote acknowledged admission), audit `outcome="delivered"`. The task is on the remote mailbox, never the local one.
- **403** → `Response::Error` ("refused by the remote host"), audit `outcome="refused", reason="remote_refused"` — a remote rejection is surfaced as a distinct error, never reported as a successful queue.
- any other status → `Response::Error`, audit `reason="remote_error"`.
- timeout or connection failure → `Response::Error` ("unreachable"), audit `outcome="unreachable", reason="timeout"|"transport"`.

The delivery row is best-effort, unlike the receiver's fail-closed admission row: a delivered task is already durable on the receiver, so a lost sender-side row must not invert a real delivery into a reported failure — the receiver's admission row is the accountability anchor. The timeout defaults to 10s, overridable via `NOREN_A2A_DELIVER_TIMEOUT_MS` (a zero or non-numeric value falls back to the default rather than disabling the bound). The daemon opens an outbound connection only to a known-host endpoint and never changes its own local bind; reaching a non-loopback remote is an operator-gated bind change out of scope here.

## CLI Read Envelopes

A separate family of `--json` envelopes covers read-side chain queries and most other CLI surfaces. The section is **structurally mixed**: two discriminator subfamilies coexist.

- **Unversioned `kind` subfamily.** The older shape — every envelope below carries a top-level `kind` string (e.g., `"chain_status"`, `"peer_list"`) with no `.v1` suffix. This subfamily predates the schema-suffix convention and is kept stable by unit-test shape invariants — every entry has a `*_pins_top_level_schema` test plus a `*_renders_stable_shape` test that forces docs/emitter drift to surface in review.
- **Versioned `noren.<area>.<verb>.v<n>` schema subfamily.** The newer shape — these envelopes carry a top-level `schema` string (e.g., `"noren.settlement.backfill.v1"`, `"noren.memory.backfill.v1"`) with a `.v<n>` version slot, and they do **not** carry a `kind` field. A future `.v2` envelope is a separate shape, not a field rename inside the existing `.v1` envelope. Every envelope in this subfamily is now anchored by a `*_pins_top_level_schema` test in the same style as the kind-subfamily envelopes; a refactor that drops a key or renames the schema literal will fail the test rather than silently drift the wire shape.

The two subfamilies are **mutually exclusive** at the top level: a `kind`-subfamily envelope never carries `schema`, and a `schema`-subfamily envelope never carries `kind`. Consumers must inspect which discriminator key is present before routing — a defensive parser that reads only one will misclassify envelopes from the other subfamily. The blocks below note which discriminator each envelope uses in the per-envelope shape table.

In addition to the per-envelope `*_pins_top_level_schema` unit tests, the docs/emitter symmetry across every envelope literal in this section is enforced by `agent-os/scripts/validate-cli-envelope-docs.mjs`. The validator fails if any listed envelope kind or schema literal appears in only one of the two surfaces (this document vs. the CLI emitter at `agent-os/crates/noren/src/main.rs`); the kinds-array comment in the validator documents the maintenance contract.

`noren chain status --json` emits:

- `kind`: literal string `"chain_status"`. Pinned at the value level by `main.rs:5878` (asserts `value["kind"].as_str() == Some("chain_status")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `status`: a structured `noren_ipc::ChainStatus` object with the following fields. The top-level object has exactly two keys (`kind` and `status`); the inner `status` is pinned by the schema test at `main.rs:5879-5882` to be a JSON object, never a string blob.

The inner `ChainStatus` shape, defined at `agent-os/crates/noren-ipc/src/lib.rs:42`:

- `chain` (string) — chain family identifier, currently `"eip155:4663"`.
- `cluster` (string) — named cluster (`devnet`, `testnet`, `mainnet-beta`, `localnet`, or a custom alias).
- `rpc_url` (string | null) — resolved RPC endpoint, null when not configured.
- `ws_url` (string | null) — resolved websocket endpoint, null when not configured.
- `program_id` (string | null) — base58 settlement program ID, null when not configured.
- `token_address` (string | null) — token contract address (0x…), null when not configured.
- `ready` (bool) — true when every required config field is present.
- `missing` (array of strings) — names of the absent config fields when `ready` is false; an empty array when `ready` is true.

The envelope source-of-truth lives at `chain_status_json` in `agent-os/crates/noren/src/main.rs:3248`. Two unit tests at `main.rs:5840` (`chain_status_json_renders_stable_shape`) and `main.rs:5862` (`chain_status_json_pins_top_level_schema`) enforce the top-level key set verbatim; the second test's failure message names this document as the forcing function for docs/emitter drift.

`noren verify --json` emits a cross-check report comparing the audit log against memory and receipt rows. Envelope shape:

- `kind`: literal string `"verify_report"`. Pinned at the value level by `main.rs:5950` (asserts `value["kind"].as_str() == Some("verify_report")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `window` (u64): the audit-window record count echoed back from the `--window` argument. Pinned as u64 by `main.rs:5951-5954` — never a string.
- `checks` (array of `VerifyCheck`): per-check results, see below. Pinned as an array by `main.rs:5959-5962` — never null or a string.
- `drift` (array of `VerifyDrift`): correlation gaps, see below. Pinned as an array by `main.rs:5963` — never null or a string blob.
- `orphans_total` (u64): total number of unmatched rows the checks discovered. Pinned as u64 by `main.rs:5955-5958` — never a string-of-integer.

Top-level keys are pinned to exactly these five by the test at `agent-os/crates/noren/src/main.rs:5934` (`verify_report_json_pins_top_level_schema`).

`VerifyCheck` shape, defined at `agent-os/crates/noren-ipc/src/lib.rs:26`:

- `name` (string) — human-readable check name (e.g., `"memory audit"`).
- `passed` (bool) — whether the check passed.
- `message` (string) — diagnostic message (empty when the check passed cleanly).

`VerifyDrift` shape, defined at `agent-os/crates/noren-ipc/src/lib.rs:33`:

- `kind` (string) — drift category (e.g., `"memory_without_audit"`).
- `id` (string, omitted when null) — record identifier when the drift entry binds to a specific row. Serialized via `#[serde(default, skip_serializing_if = "Option::is_none")]` at `noren-ipc/src/lib.rs:35-36`, so absent rather than `null` when unbound.
- `message` (string) — drift description.
- `repair` (string) — operator-facing remediation hint.

The envelope source-of-truth lives at `verify_report_json` in `agent-os/crates/noren/src/main.rs:3255`. The shape-pinning test at `main.rs:5934-5980` covers both the populated and empty cases (`assert_shape` runs against a one-check, one-drift report and an all-empty report).

`noren tools list --json` emits the registered MCP-style tool catalog. Envelope shape:

- `kind`: literal string `"tool_list"` (singular `tool_list`, not `tools_list`; consumers routing on `kind` must match the literal exactly). Pinned at the value level by `main.rs:5696` (asserts `value["kind"].as_str() == Some("tool_list")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `tools` (array of `ToolSpec`): the registered tools the daemon advertises via `tools/list`. The array is empty when no tools are registered; the unsuffixed CLI prints `(no tools registered)` for that case at `main.rs:1803`. Pinned as an array by `main.rs:5697-5700` — never null or a string blob.

The inner `ToolSpec` shape, defined at `agent-os/crates/noren-mcp/src/lib.rs:27`:

- `name` (string) — tool identifier.
- `description` (string) — human-readable tool summary.
- `inputSchema` (object) — JSON Schema for the tool's `arguments` object; an empty object means the tool takes no arguments.

`ToolSpec` carries `#[serde(rename_all = "camelCase")]` (`noren-mcp/src/lib.rs:26`) so the Rust field `input_schema` serializes on the wire as `inputSchema`. The naming matches the MCP wire format; JSON consumers must deserialize using `inputSchema`, not `input_schema`.

Top-level keys are pinned to exactly these two by the test at `agent-os/crates/noren/src/main.rs:5680` (`tool_list_json_pins_top_level_schema`), which exercises both a populated single-tool case and an empty list.

The envelope source-of-truth lives at `tool_list_json` in `agent-os/crates/noren/src/main.rs:3220`. Two unit tests at `main.rs:5656` (`tool_list_json_renders_stable_shape`) and `main.rs:5680` cover both cases. The CLI verb is wired at `main.rs:1013-1039`; without `--json`, the same response prints one line per tool in the form `<name> — <description>` at `main.rs:1806`.

`noren tools call <name> [--args <json>] --json` emits the tool invocation result. Envelope shape:

- `kind`: literal string `"tool_result"` (singular, not `tools_result`; consumers routing on `kind` must match the literal exactly). Pinned at the value level by `main.rs:5756` (asserts `value["kind"].as_str() == Some("tool_result")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `name` (string): the tool name echoed back from the CLI argument. Pinned as a string by `main.rs:5757` — never an object or array.
- `content` (array of `Content`): the tool's output blocks. Each element is a tagged-enum object whose `type` discriminator selects the variant — `{type: "text", text: <string>}` for textual output or `{type: "json", value: <JSON>}` for structured output. The variants are defined at `agent-os/crates/noren-mcp/src/lib.rs:39` with `#[serde(tag = "type", rename_all = "camelCase")]`; v0 ships text and json variants only. The array is empty when the tool produced no output blocks; the unsuffixed CLI prints each block sequentially at `main.rs:1080-1086`. Pinned as an array by `main.rs:5758-5761` — never null or a string.
- `is_error` (boolean): `true` when the tool itself raised; pinned as a JSON boolean by the schema test (`main.rs:5762-5765`) — never `0`/`1` or a string. JSON consumers must branch on this boolean, not on the presence/absence of content. `is_error=true` paired with non-empty `content` describes a partial-success outcome with an error indicator.

Top-level keys are pinned to exactly these four by the test at `agent-os/crates/noren/src/main.rs:5740` (`tool_result_json_pins_top_level_schema`), exercised against both a non-empty content + is_error=true case and an empty content + is_error=false case.

The envelope source-of-truth lives at `tool_result_json` in `agent-os/crates/noren/src/main.rs:3227`. Two unit tests at `main.rs:5719` (`tool_result_json_renders_stable_shape`) and `main.rs:5740` cover the shape. The CLI verb is wired at `main.rs:1040-1086`; without `--json`, each `Content::Text` block prints its `text` directly and each `Content::Json` block prints its `value` as pretty-printed JSON.

`noren chain flush-receipts --json` emits a receipt-batch summary when it groups local settlement receipts into a single receipt-root transaction. Envelope shape:

- `kind`: literal string `"receipt_batch_flushed"`. Pinned at the value level by `main.rs:6018` (asserts `value["kind"].as_str() == Some("receipt_batch_flushed")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `limit` (u64): the batch-size cap echoed back from the `--limit` argument. Pinned as u64 by `main.rs:6019-6022` — never a string.
- `receipts_updated` (u64): the number of local receipt rows updated to point at the new batch. Pinned as u64 by `main.rs:6023-6026` — never a string-of-integer.
- `batch` (`ReceiptBatchSummary` object): the batch's wire shape, see below. Pinned as a structured object by `main.rs:6027-6030` — never a string blob.

Top-level keys are pinned to exactly these four by the test at `agent-os/crates/noren/src/main.rs:6002` (`flush_receipts_json_pins_top_level_schema`).

`ReceiptBatchSummary` shape, defined at `agent-os/crates/noren-ipc/src/lib.rs:54`:

- `batch_id` (string) — opaque batch identifier.
- `merkle_root` (string, 64 hex characters) — Merkle root over the included receipts.
- `receipt_count` (u32) — number of receipts in the batch (note u32, not u64).
- `tx_sig` (string or null) — transaction hash once the batch confirms; null before submission completes.
- `slot` (u64 or null) — confirmation slot once available; null until then.

The envelope source-of-truth lives at `flush_receipts_json` in `agent-os/crates/noren/src/main.rs:3270`. Two unit tests at `main.rs:5983` (`flush_receipts_json_renders_stable_shape`) and `main.rs:6002` (`flush_receipts_json_pins_top_level_schema`) cover both the unconfirmed (`tx_sig`/`slot` null) and confirmed (both present) batch states.

`noren chain receipt-batches --json` emits the list of recent receipt batches recorded on-chain. Envelope shape:

- `kind`: literal string `"receipt_batch_list"`. Pinned at the value level by `main.rs:5816` (asserts `value["kind"].as_str() == Some("receipt_batch_list")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `limit` (u64): the result cap echoed back from the `--limit` argument. Pinned as u64 by `main.rs:5817-5820` — never a string.
- `batches` (array of `ReceiptBatchSummary`): the batches, in the order returned by the daemon. Each item uses the same `ReceiptBatchSummary` shape documented above (including the `tx_sig`/`slot` null convention for batches whose settlement transaction has not yet confirmed). The array may be empty. Pinned as an array by `main.rs:5821-5824` — never null or a string.

Top-level keys are pinned to exactly these three by the test at `agent-os/crates/noren/src/main.rs:5800` (`receipt_batch_list_json_pins_top_level_schema`).

The envelope source-of-truth lives at `receipt_batch_list_json` in `agent-os/crates/noren/src/main.rs:3240`. Two unit tests at `main.rs:5782` (`receipt_batch_list_json_renders_stable_shape`) and `main.rs:5800` (`receipt_batch_list_json_pins_top_level_schema`) cover the populated and empty cases.

`noren receipts recent [-n|--limit <N>] [--since-ms <M>] --json` emits a window of local settlement receipts. Envelope shape:

- `kind`: literal string `"receipt_list"` — verb-name asymmetry: the CLI verb is `recent` but the envelope discriminator is `receipt_list` (singular `receipt_`, not `receipts_`); consumers routing on `kind` must match the literal exactly rather than reusing the verb token or pluralising. Pinned at the value level by `main.rs:4214` (asserts `value["kind"].as_str() == Some("receipt_list")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `limit` (u64): the request limit echoed back from `-n`/`--limit` (default `10`, per `main.rs:736`). Pinned at the type level by the schema test (`main.rs:4215-4218`) — never a string.
- `since_ms` (u64 or null): the Unix-epoch millisecond threshold echoed from `--since-ms`, or `null` when the flag was omitted. Pinned as u64-or-null at the schema test (`main.rs:4219-4222`) — never a string-of-integer. Filter semantics live with the daemon's `Request::RecentReceipts` handler; this surface only echoes the operator's input.
- `receipts` (array of `SettlementReceipt`): the matched receipts in the order returned by the daemon. The array is empty when no receipts fall in the window; the unsuffixed CLI prints `(no receipts)` for that case at `main.rs:766`. Pinned as an array by `main.rs:4223-4226` — never null or a string.

The inner `SettlementReceipt` shape, defined at `agent-os/crates/noren-types/src/lib.rs:392`:

- `id` (string) — receipt UUID, serialized as the canonical hyphenated string form.
- `payer` (object) — `{display: string, pubkey: string (base58)}` per the `AgentId` Serialize impl at `noren-types/src/lib.rs:177`.
- `resource` (string) — `ResourceKind` slug, exactly one of `"compute"`, `"memory"`, `"tool"`, `"message"`, `"registration"` (lowercase per `#[serde(rename_all = "lowercase")]` at `noren-types/src/lib.rs:35`). Consumers must route on the lowercase wire form, **not** the Rust enum names (`"Compute"`, `"Memory"`, etc.) — those never appear on the wire.
- `memory_record_id` (string, omitted when null) — record identifier when the receipt settled a memory write. Serialized via `#[serde(default, skip_serializing_if = "Option::is_none")]` at `noren-types/src/lib.rs:396-397` — so **absent rather than null** when unbound. This is the single asymmetry among the Option fields: every other optional field below carries `#[serde(default)]` without `skip_serializing_if`, so those keys are **always emitted** (as `null` when absent). JSON consumers must check `memory_record_id` with key-existence, not null-vs-value.
- `credits_consumed` (u64) — USD-pegged credits destroyed at this event.
- `settled_at` (u64) — Unix-epoch milliseconds when the receipt was issued locally.
- `chain` (string or null) — chain family identifier (e.g. `"eip155:4663"`) once the receipt has been batched and confirmed on-chain; `null` until then. Always present on the wire.
- `cluster` (string or null) — named cluster (e.g. `"devnet"`); `null` until on-chain confirmation. Always present on the wire.
- `batch_id` (string or null) — opaque receipt-batch identifier once the receipt is included in a batch; `null` until then. Always present on the wire.
- `merkle_root` (string or null) — 64-hex Merkle root of the batch the receipt was included in; `null` until then. Always present on the wire.
- `tx_sig` (string or null) — transaction hash once the batch confirms; `null` until then. Always present on the wire.
- `slot` (u64 or null) — confirmation slot once available; `null` until then. Always present on the wire.
- `confirmed_at` (u64 or null) — Unix-epoch milliseconds when the on-chain transaction confirmed; `null` until then. Always present on the wire.
- `onchain_sig` (string or null) — backwards-compatible alias for `tx_sig` (per the struct doc-comment at `noren-types/src/lib.rs:388-390`) that older clients still consume; new consumers should prefer `tx_sig`. Always present on the wire. Both fields carry the same value once the receipt confirms; the unsuffixed CLI's `(local-only)` fallback at `main.rs:1553-1556` reads `tx_sig` first and falls back to `onchain_sig` for exactly that reason.

Top-level keys are pinned to exactly these four by the test at `agent-os/crates/noren/src/main.rs:4198` (`receipt_list_json_pins_top_level_schema`), exercised against three cases: populated with `since_ms`, populated without `since_ms`, and empty without `since_ms`.

The envelope source-of-truth lives at `receipt_list_json` in `agent-os/crates/noren/src/main.rs:3032`. Two unit tests at `main.rs:4157` (`receipt_list_json_renders_stable_shape`) and `main.rs:4198` cover the shape. The CLI verb is wired at `main.rs:731-784`; without `--json`, each receipt is printed as `[<settled_at>] <resource>: <credits> credits — <onchain>` at `main.rs:774-777`, with `<onchain>` resolving to the `tx_sig`/`onchain_sig` value or the literal `(local-only)` when both are null.

`noren ping --json` emits a daemon-liveness probe. Envelope shape:

- `kind`: literal string `"daemon_ping"`. Pinned at the value level by `main.rs:4578` (asserts `value["kind"].as_str() == Some("daemon_ping")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `status`: literal string `"ok"` — the daemon only returns this envelope when it has accepted the request and produced a `Response::Pong`; failures surface as a non-zero CLI exit rather than a non-`"ok"` payload, so consumers can branch on transport success alone. Pinned as a string by `main.rs:4579-4582` — never an integer or boolean. The literal value `"ok"` is also pinned at the value level by `main.rs:4583` (asserts `value["status"].as_str() == Some("ok")`), so a future status-rename fails the test rather than silently rewriting the literal.

Top-level keys are pinned to exactly these two by the test at `agent-os/crates/noren/src/main.rs:4564` (`ping_json_pins_top_level_schema`).

The envelope source-of-truth lives at `ping_json` in `agent-os/crates/noren/src/main.rs:3062`. The shape-pinning tests at `main.rs:4557` (`ping_json_renders_stable_shape`) and `main.rs:4564` cover the single emitted shape; the CLI verb is wired at `main.rs:1960-1982` (the unsuffixed `noren ping` prints `pong` instead).

`noren intent [--json] [--stream] <text>` emits the dispatched intent's outcome with optional settlement evidence. Envelope shape:

- `kind`: literal string `"intent_result"`. Pinned at the value level by `main.rs:4509` (asserts `value["kind"].as_str() == Some("intent_result")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `intent_id` (string): the dispatched intent's UUID, serialized as the canonical hyphenated string form. Pinned as a string by the schema test (`main.rs:4510-4513`) — never a byte array or struct.
- `status` (string): the outcome status (e.g., `"ok"`). Pinned as a string by `main.rs:4514-4517` — never an object or array. Specific value enumeration lives with the daemon's intent dispatcher rather than this docs surface.
- `text` (string): the result text the daemon returned. The unsuffixed CLI prints this value directly at `main.rs:751` (a single-line `println!("{text}")`), so `noren intent --json` and `noren intent` share the result payload but only `--json` wraps it in the envelope. Pinned as a string by `main.rs:4518` — never an object or array.
- `sources` (array of strings): source labels that contributed to the result (e.g., `["research"]`). Pinned as an array of strings by `main.rs:4519-4522` — never a comma-joined string. Empty when no sources are attached.
- `settlement` (object or null): an optional `SettlementReceipt` (defined at `agent-os/crates/noren-types/src/lib.rs:392`) carrying the on-chain or local settlement evidence when the intent consumed credits. `null` when the intent did not settle (e.g., a phase-0 echo that does not charge). Pinned as object-or-null by `main.rs:4523-4526` — never an integer or array.

Top-level keys are pinned to exactly these six by the test at `agent-os/crates/noren/src/main.rs:4486` (`intent_result_json_pins_top_level_schema`), exercised against both a populated `Some(SettlementReceipt)` case and an empty unsettled case.

The envelope source-of-truth lives at `intent_result_json` in `agent-os/crates/noren/src/main.rs:3045`. Two unit tests at `main.rs:4468` (`intent_result_json_renders_stable_shape`) and `main.rs:4486` cover the shape. The CLI verb is wired at `main.rs:1983-2057`; the `--json`/`--stream` flags are recognized only in leading position (`main.rs:1996-92`) so an interior `--json` token is preserved as part of the intent text. The optional `--stream` flag sets `Request::SubmitIntent.prefer_stream = Some(true)` (`main.rs:715`), enabling the v2 streaming-response path documented under [docs/protocol-versioning.md](./protocol-versioning.md); the terminal `IntentResult` envelope shape is unchanged when the streaming path is not selected.

`GET /intents/:id/events` (HTTP-only) opens a `text/event-stream` connection that emits one frame per agent runtime event whose `intent_id` matches the path parameter. Frames carry an `AgentEvent` JSON object (`#[serde(tag = "type", rename_all = "snake_case")]`, defined in `noren-types/src/lib.rs`) — the public taxonomy with four variants `reasoning`, `tool_call`, `tool_result`, and `file_write`. Runner-side `RuntimeTrace` rows are projected into this taxonomy at the SSE boundary (see `impl From<&RuntimeTrace> for AgentEvent` in `noren-runtime/src/lib.rs`) so the wire form survives runner swaps without breaking browser clients. The `reasoning` slot is reserved: today the Hermes adapter drops reasoning frames at the SSE seam because they are too high-volume to audit, so no runner emits this variant yet — the slot is wire-compatible so a future runtime can stream condensed reasoning summaries without breaking older clients. Approval frames surface as `tool_call` / `tool_result` with `tool = "approval"`; the audit chain keeps the durable `hermes_approval_requested` / `hermes_approval_resolved` rows for the runner-specific record. The endpoint replaces the 3-second poll on `/intents/:id/result` for the live trace view — a browser opens one `EventSource` per intent page and renders each frame the moment the daemon flushes it. The web client caps the rendered step list at the most recent 200 entries (with an explicit operator opt-in to expand to the full set) so a long-running run does not stall the React reconciler on slow machines; the cap matches the audit fetch `limit=200`, so widening one without the other would silently drop history at the seam. The endpoint subscribes to a daemon-side `tokio::sync::broadcast` fan-out populated by `spawn_runtime_event_drainer` in `agent-os/crates/norend/src/lib.rs:618`; the channel exists unconditionally, but the drainer that publishes to it only runs when `NOREN_LIVE_TRACE=1`, so the endpoint streams nothing until the operator opts into live tracing. Audience model mirrors `/intents/:id/result`: any authenticated peer can stream any intent. Slow subscribers that fall behind the broadcast capacity drop the lagged window and keep streaming; the audit chain is the durable record. Reconnects do not replay missed frames — a client that needs the durable history fetches `/audit/recent` instead.

Because the trace is published live with no backfill, a client follows a specific in-flight intent by subscribing while the run is still working. A Hermes-routed intent dispatches asynchronously: `POST /intent` returns an `intent_result` with `status: "running"` and the `intent_id` immediately, then the run streams its trace from a background task, so the client takes that id and opens `GET /intents/:id/events` before the frames it wants are flushed. The path id is a hard filter, not a hint — each subscriber receives only frames whose `StreamedTrace.intent_id` equals its path parameter, so one intent's trace never appears on another intent's stream even though every subscriber reads the same daemon-wide broadcast. The full path — asynchronous dispatch, broadcast subscription, per-intent filtering, and the SSE header trio (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`) — is exercised end to end over HTTP by `agent-os/crates/norend/tests/live_http_intent_events_sse.rs` (opt-in, requires `NOREN_LIVE_TRACE=1`), which stands up an in-process Hermes gateway, drives a `tool.started` trace through one intent, and asserts a concurrent stream subscribed to a different id stays empty.

`POST /x402/pay` (HTTP-only spend trigger) forwards a `PayX402Body` to the same `Request::PayX402` the unix socket serves, so a caller that can only reach the gateway can still drive the daemon's sole outbound payment. The handler fails closed in a fixed gate order before any funds move: the `x402.outbound.pay` capability, then the grant's destination scope, then a configured-and-enabled dispatch sidecar, then a valid HTTP method, and only then the `per_call_cap` decimal-`u128` parse — a malformed or over-`u128::MAX` cap is rejected before the signer subprocess is constructed or any network call is made. A daemon-level rejection surfaces over HTTP as a `200` response whose body is `{"kind": "error", ...}`, not a `4xx`, so clients route on the envelope `kind` rather than the status line. The capability-gate-then-cap-parse ordering is exercised end to end over the gateway by `agent-os/crates/norend/tests/live_http_x402_pay_fail_closed.rs` (opt-in; enables dispatch from env with a `/bin/true` signer so the path is hermetic), which asserts an ungranted call is rejected by name on the capability gate and, after the grant, a malformed and an over-`u128::MAX` cap are both rejected by the parse gate — mirroring the socket-side `live_ipc_pay_x402_invalid_cap.rs` across the HTTP boundary.

`noren capabilities recent [-n|--limit <N>] --json` emits a peer-scoped view of recent signed capabilities. Envelope shape:

- `kind`: literal string `"capability_list"` — verb-name asymmetry: the CLI verb is `recent` but the envelope discriminator is `capability_list`. Consumers routing on `kind` must match the latter literal exactly rather than reusing the verb token. Pinned at the value level by `main.rs:4643` (asserts `value["kind"].as_str() == Some("capability_list")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `limit` (u64): the request limit echoed back from `-n`/`--limit` (default `10`, see `main.rs:1251`). Pinned at the type level by the schema test (`main.rs:4644-4647`) — JSON consumers must never receive a string here.
- `capabilities` (array of `SignedCapability`): the filtered live capabilities. Each element has shape `{capability: Capability, signature: <base58>}` where `Capability` is defined at `agent-os/crates/noren-types/src/lib.rs:224` (fields: `subject`, `action`, `scope`, `granted_by`, `expires_at`) and `SignedCapability` is defined at `agent-os/crates/noren-permissions/src/lib.rs:58`. The `signature` field is the base58 encoding of the 64-byte ed25519 signature (per the `sig_b58` serde module at `lib.rs:64-84`), never the raw byte array. Pinned as an array by `main.rs:4648-4651` — never null or a string.

The daemon applies a **peer-visibility filter** before returning the list (see `recent_capabilities` at `agent-os/crates/norend/src/lib.rs:15873-15889`): only capabilities whose `subject.pubkey` or `granted_by.pubkey` matches the requesting peer's pubkey are included. JSON consumers must not assume this is a global registry dump — operator and delegated callers see a different slice of the same store.

Top-level keys are pinned to exactly these three by the test at `agent-os/crates/noren/src/main.rs:4627` (`capability_list_json_pins_top_level_schema`), which exercises both a populated single-capability case and an empty list.

The envelope source-of-truth lives at `capability_list_json` in `agent-os/crates/noren/src/main.rs:3069`. Two unit tests at `main.rs:4587` (`capability_list_json_renders_stable_shape`) and `main.rs:4627` cover both cases. The CLI verb is wired at `main.rs:3008-530`; without `--json`, the same response prints one line per capability in the form `<subject_display> → <action_label> (<granted_by_display>) [<expiry>]` at `main.rs:1294-1300`, or `(no capabilities granted)` when the filtered list is empty.

`noren capabilities grant <action> [--scope <json>] [--expires-at <ms>] --json` emits the freshly-signed capability after the daemon accepts the grant. Envelope shape:

- `kind`: literal string `"capability_granted"` — past-tense outcome name, distinct from the verb name `grant`; consumers routing on `kind` must match the literal exactly rather than reusing the verb token. Pinned at the value level by `main.rs:4716` (asserts `value["kind"].as_str() == Some("capability_granted")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `subject_display` (string): the daemon-synthesized human-readable subject (e.g., `operator@local`). The daemon owns this field — consumers must not reconstruct it from the request. Pinned as a string by `main.rs:4717-4720` — never an object or array.
- `action` (string): the action the capability was granted for. **Not always the verbatim CLI argument**: when the CLI receives an a2a peer-prefix shorthand it expands the prefix to the full peer-bound action before signing (see `expand_a2a_action` invoked at `main.rs:563-596`); the envelope reports the post-expansion full form, and the unsuffixed CLI prints an `expanding <prefix> → <full>` line to stderr at `main.rs:1362`. Pinned as a string by `main.rs:4721-4724` — never an object or array.
- `signature_b58` (string): the base58 signature over the signed-capability bytes. This is the same value consumers pass back to `noren capabilities revoke <signature-b58>` to tombstone the capability. Pinned as a string by `main.rs:4725-4728` — never an object or array.
- `scope` (object or null): the structured scope object echoed from the request, or `null` when `--scope` was omitted. Pinned at the type level by the schema test (`main.rs:4729-4732`) — JSON consumers must never receive a string blob here, so a scope value of `"{\"version\":1}"` would be a contract break.
- `expires_at` (u64 or null): the Unix-epoch millisecond expiry echoed from `--expires-at`, or `null` when the flag was omitted. Pinned at the type level by the schema test (`main.rs:4733-4736`) — JSON consumers must never receive a string here, so a value of `"1700000000000"` would be a contract break.

Top-level keys are pinned to exactly these six by the test at `agent-os/crates/noren/src/main.rs:4693` (`capability_grant_json_pins_top_level_schema`), which also asserts the `scope` object-or-null and `expires_at` u64-or-null typing.

The envelope source-of-truth lives at `capability_grant_json` in `agent-os/crates/noren/src/main.rs:3077`. Two unit tests at `main.rs:4670` (`capability_grant_json_renders_stable_shape`, covers both a scoped+timed grant and an unscoped+untimed grant) and `main.rs:4693` cover both populated cases. The CLI verb is wired at `main.rs:532-624`; without `--json`, the same response prints `granted: <subject> → <action>` followed by the signature on a second line.

`noren capabilities revoke <signature-b58> --json` emits the outcome of revoking a single signed capability by its signature. Envelope shape:

- `kind`: literal string `"capability_revoked"` — past-tense outcome name, distinct from the verb name `revoke`; consumers routing on `kind` must match the literal exactly rather than reusing the verb token. Pinned at the value level by `main.rs:4786` (asserts `value["kind"].as_str() == Some("capability_revoked")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `signature_b58` (string): the base58 signature echoed back from the request, so consumers can correlate the response to the revoke call without tracking it out of band. Pinned as a string by `main.rs:4787-4790` — never an object or array.
- `removed` (boolean): `true` if a live capability matched and was tombstoned, `false` if no live row matched that signature. Pinned as a JSON boolean by `main.rs:4791-4794` — never `0`/`1` or a string. `false` is a benign no-op outcome, not an error — the daemon still returns `Response::CapabilityRevoked` and the unsuffixed CLI prints `(no live capability with that signature)` for that case at `main.rs:1451`. JSON consumers must not treat `removed=false` as a failure.

Top-level keys are pinned to exactly these three by the test at `agent-os/crates/noren/src/main.rs:4770` (`capability_revoke_json_pins_top_level_schema`), which also asserts `removed` is a JSON boolean (never `0`/`1` or a string).

The envelope source-of-truth lives at `capability_revoke_json` in `agent-os/crates/noren/src/main.rs:3094`. Two unit tests at `main.rs:4757` (`capability_revoke_json_renders_stable_shape`) and `main.rs:4770` cover both the `removed=true` and `removed=false` cases. The CLI verb is wired at `main.rs:1737-680`.

`noren capabilities purge --json` emits a summary of revoked-capability garbage collection. Envelope shape:

- `kind`: literal string `"capabilities_purged"`. Pinned at the value level by `main.rs:4826` (asserts `value["kind"].as_str() == Some("capabilities_purged")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `before_ms` (u64): the resolved Unix-epoch millisecond cutoff. The CLI accepts either `--before-ms <M>` (echoed verbatim) or `--older-than-ms <D>` (resolved against the system clock as `now - D` per `main.rs:1477-1481`); the envelope always reports the single resolved value, so consumers cannot distinguish which input form the operator typed. Pinned as u64 by `main.rs:4827-4830` — never a string-of-integer.
- `purged` (u64): the count of revoked-capability rows removed. May legitimately be `0` when no rows matched the cutoff — the verb does not error on an empty purge. Pinned as u64 by `main.rs:4831-4834` — never a string-of-integer.

Top-level keys are pinned to exactly these three by the test at `agent-os/crates/noren/src/main.rs:4810` (`capabilities_purge_json_pins_top_level_schema`).

The envelope source-of-truth lives at `capabilities_purge_json` in `agent-os/crates/noren/src/main.rs:3102`. Two unit tests at `main.rs:4802` (`capabilities_purge_json_renders_stable_shape`) and `main.rs:4810` (`capabilities_purge_json_pins_top_level_schema`) cover the populated (`purged=3`) and empty (`purged=0`) cases. The CLI verb is wired at `main.rs:1782-730`; without `--json`, the same response prints `purged <n> revoked capability(ies)`.

`noren peers list [--limit <N>] [--prefix <P>] [--live-only|--revoked-only] --json` emits the registered peer roster filtered by the supplied flags. Envelope shape:

- `kind`: literal string `"peer_list"`. Pinned at the value level by `main.rs:3772` (asserts `value["kind"].as_str() == Some("peer_list")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `limit` (u64): the request limit echoed back from `--limit` (default `20`, per `main.rs:2426`). Pinned as u64 by `main.rs:3773-3776` — never a string.
- `filter_pubkey_prefix` (string or null): the prefix echoed from `--prefix`, or `null` when the flag was omitted. Pinned at the type level by the schema test (`main.rs:3777-3781`) — never an integer or array.
- `matched_count` (u64): row count of the `peers` array; equals the exhaustive match count when `truncated` is `false`. Pinned as u64 by `main.rs:3782-3785` — never a string.
- `peers` (array of `PeerSummary`): the matched roster slice, see below. Pinned as an array by `main.rs:3786` — never null or a string blob.
- `operator_pubkey_b58` (string): the requesting operator's own pubkey in base58. The unsuffixed CLI line formatter at `peer_list_lines` (`main.rs:2247`) compares each peer's `pubkey_base58()` against this value to append a ` (self)` marker on the operator's own row; JSON consumers must apply the same comparison to render the self-tag, not assume the operator's row is reliably first. Pinned as a string by `main.rs:3787-3790` — never an object or array.
- `truncated` (boolean): `true` when the registry held more matching entries than `limit`, `false` otherwise. Pinned as a JSON boolean by the schema test at `main.rs:3791-3794` — never `0`/`1`. **This is the only signal of incomplete results**; `matched_count == limit` with `truncated == false` means the page is the exhaustive match set, not a hint to paginate.

The inner `PeerSummary` shape, defined at `agent-os/crates/noren-peer-auth/src/lib.rs:158`:

- `agent_id` (object) — `{display: string, pubkey: string (base58)}` per the `AgentId` Serialize impl at `noren-types/src/lib.rs:177`.
- `token_prefix` (string) — 6-character redacted token prefix, the same value `peers revoke <token-prefix>` accepts. The full token bytes are never on the wire — same invariant as `Response::PeerList`.
- `registered_at` (u64) — Unix-epoch milliseconds when the peer registered.
- `revoked_at` (u64 or null) — Unix-epoch milliseconds when the peer was tombstoned; `null` for live entries. Composes with the `--live-only`/`--revoked-only` flags (and the equivalent `status_filter` query parameter described above) for filtering — the filter runs before the registry's truncation peek.

Top-level keys are pinned to exactly these seven by the test at `agent-os/crates/noren/src/main.rs:3748` (`peer_list_json_pins_top_level_schema`), exercised against a populated two-peer (one live, one revoked) case and an empty case.

The envelope source-of-truth lives at `peer_list_json` in `agent-os/crates/noren/src/main.rs:2938`. Schema and behavioral tests live at `main.rs:3748` (key set + per-key typing), `main.rs:3715` (`peer_list_json_echoes_prefix_and_match_count`), `main.rs:3729` (`peer_list_json_omits_prefix_when_inactive`), and `main.rs:3740` (`peer_list_json_reports_zero_match_count_for_empty_response`). The CLI verb is wired at `main.rs:1613-1666`; without `--json`, the same response is rendered line-by-line by `peer_list_lines` (`main.rs:2247`) with a `(truncated; <n> shown — narrow with --prefix or raise --limit)` hint appended when `truncated` is `true` (`main.rs:2278`). See also the **Query Parameters** section above for the same filter composition rules over the HTTP gateway.

`noren peers purge --json` emits a summary of revoked-peer garbage collection. Envelope shape:

- `kind`: literal string `"peers_purged"` — the only structural disambiguator from `capabilities_purged`; both envelopes share the same three-key layout, so consumers that route on `kind` must check the full literal rather than treating any `*_purged` envelope as interchangeable. Pinned at the value level by `main.rs:4866` (asserts `value["kind"].as_str() == Some("peers_purged")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `before_ms` (u64): resolved Unix-epoch millisecond cutoff. The CLI accepts `--before-ms` or `--older-than-ms` with the same resolution semantics as `noren capabilities purge --json` above. Pinned as u64 by `main.rs:4867-4870` — never a string-of-integer.
- `purged` (u64): count of revoked-peer rows removed. Only revoked rows are eligible — the verb does not touch live peers (the unsuffixed CLI prints `purged <n> revoked peer(s)` at `main.rs:1563`). May legitimately be `0` when no rows matched. Pinned as u64 by `main.rs:4871-4874` — never a string-of-integer.

Top-level keys are pinned to exactly these three by the test at `agent-os/crates/noren/src/main.rs:4850` (`peers_purge_json_pins_top_level_schema`).

The envelope source-of-truth lives at `peers_purge_json` in `agent-os/crates/noren/src/main.rs:3110`. Two unit tests at `main.rs:4842` (`peers_purge_json_renders_stable_shape`) and `main.rs:4850` cover the populated and empty cases. The CLI verb is wired at `main.rs:1523-1569`.

`noren peers rotate --json` emits the new operator token after rotation. Envelope shape:

- `kind`: literal string `"peer_token_rotated"`. Pinned at the value level by `main.rs:4905` (asserts `value["kind"].as_str() == Some("peer_token_rotated")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `token_b58` (string): the full base58 operator token. The value is the new authentication credential, not a fingerprint — the envelope is **secret-bearing** and JSON output must be treated as sensitive (no logging, no shell history capture, no transport over unsecured channels). Pinned as a string by `main.rs:4906-4909` — never bytes or a structured object.

Top-level keys are pinned to exactly these two by the test at `agent-os/crates/noren/src/main.rs:4889` (`peers_rotate_json_pins_top_level_schema`).

Side effects before the envelope returns (per the CLI comment at `main.rs:2364-2370`): the daemon has already persisted the new token to `$NOREN_HOME/peers/operator.token` (mode `0600`), so the envelope is informational. Existing shells holding the previous token continue to authenticate with the old value until they re-read the file; consumers that cache the token in memory must refresh after rotation.

The envelope source-of-truth lives at `peers_rotate_json` in `agent-os/crates/noren/src/main.rs:3118`. The shape-pinning tests at `main.rs:4882` (`peers_rotate_json_renders_stable_shape`) and `main.rs:4889` (`peers_rotate_json_pins_top_level_schema`) cover both a typical-token case and an empty-string defensive case (the latter exercises the key-set invariant rather than a legitimate runtime value). The CLI verb is wired at `main.rs:1570-1605`; without `--json`, the same response prints a two-line message terminating in the raw token value.

`noren peers revoke <token-prefix> [--force] [--limit-matches <N>] --json` emits the outcome of revoking a single peer by its base58 token prefix. Envelope shape:

- `kind`: literal string `"peer_revoke"` — verb-form, not past-tense. Distinct from the sibling envelopes whose outcome names took the past-tense form (`capability_revoked`, `peer_token_rotated`, `peers_purged`); consumers routing on `kind` must match the literal exactly rather than guessing `peer_revoked` or `peers_revoke`. Pinned at the value level by `main.rs:3889` (asserts `value["kind"].as_str() == Some("peer_revoke")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `outcome` (object): a tagged-enum `RevokeOutcome` (defined at `agent-os/crates/noren-peer-auth/src/lib.rs:200` with `#[serde(tag = "type", rename_all = "snake_case")]`). The top-level object has exactly two keys (`kind` and `outcome`); the inner `outcome` is pinned by the schema test at `main.rs:3890-3893` to be a JSON object, never a string blob.

The five `RevokeOutcome` variants the daemon may return:

- `{type: "revoked", agent_id, token_prefix, registered_at, revoked_at}` — the unique live match was tombstoned. The four extra fields are the inlined `PeerSummary` shape documented in the `peer_list` block above; `revoked_at` carries the moment of revocation and is non-null for this variant.
- `{type: "already_revoked", agent_id, token_prefix, registered_at, revoked_at}` — same inlined `PeerSummary` shape; the unique match was already tombstoned. Idempotent — the operator's intent is satisfied — and `revoked_at` carries the *original* revocation timestamp, not the moment of this call.
- `{type: "not_found"}` — no entry's full base58 token matched the supplied prefix. No extra fields.
- `{type: "ambiguous", matches: [PeerSummary...], truncated: bool}` — more than one entry matched the prefix; the registry is unchanged. `matches.len()` is bounded by `--limit-matches`; `truncated` is `true` when more than that limit matched (see `RevokeOutcome::Ambiguous` at `noren-peer-auth/src/lib.rs:225-229`). The field carries `#[serde(default)]` so a stale CLI built before `truncated` landed still deserialises a new daemon's response (degrading to the pre-bound assumption that the displayed matches are exhaustive); the daemon-side serializer always writes the field.
- `{type: "self_revoke_forbidden", agent_id, token_prefix, registered_at, revoked_at}` — same inlined `PeerSummary` shape; the unique live match is the operator's own bootstrap row and the request did not pass `--force`. The registry is unchanged and `revoked_at` is `null` (the entry remained live). This is defence-in-depth against the "fat-finger via web UI bypassed by curl" failure mode where a UI-only confirmation guard is trivially circumvented by a direct daemon API call.

**Exit-code coupling**: the `peer_revoke_is_failure` classifier at `agent-os/crates/noren/src/main.rs:3407-3414` maps `not_found`, `ambiguous`, and `self_revoke_forbidden` to a CLI exit code of `1` — including in the `--json` path (`main.rs:2532-2534`). `revoked` and `already_revoked` map to exit `0`. JSON consumers must branch on `outcome.type` for success/failure semantics; transport success (exit `0`) is **not** synonymous with revocation success. The classifier's mapping is pinned by the test at `main.rs:6335` (`peer_revoke_json_exit_classification_matches_human_cli`).

Top-level keys are pinned to exactly these two by the test at `agent-os/crates/noren/src/main.rs:3873` (`peer_revoke_json_pins_top_level_schema`), which also asserts `outcome` is a tagged-enum object and exercises both the `Ambiguous` and `NotFound` variants.

The envelope source-of-truth lives at `peer_revoke_json` in `agent-os/crates/noren/src/main.rs:3345`. Two unit tests at `main.rs:3855` (`peer_revoke_json_renders_stable_ambiguous_shape`) and `main.rs:3873` cover the shape. The CLI verb is wired at `main.rs:1670-1770`; without `--json`, `Revoked` and `AlreadyRevoked` print tab-separated success lines to stdout, while `NotFound`, `Ambiguous`, and `SelfRevokeForbidden` print human-readable diagnostics to stderr before exiting `1`.

`noren audit recent [-n|--limit <N>] [--since-ms <M>] [--stream] --json` emits a window of audit events. Envelope shape:

- `kind`: literal string `"audit_recent"`. Pinned at the value level by `main.rs:5124` (asserts `value["kind"].as_str() == Some("audit_recent")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `limit` (u64): the request limit echoed back from `-n`/`--limit` (default `50`, per `main.rs:1104`). Pinned as u64 at the schema test (`main.rs:5125-5128`) — never a string.
- `since_ms` (u64 or null): the Unix-epoch millisecond threshold echoed from `--since-ms`, or `null` when the flag was omitted. Pinned as u64-or-null at the schema test (`main.rs:5129-5132`) — never a string-of-integer. Same semantic as the HTTP gateway query parameter described in the **Query Parameters** section above: events whose `timestamp_ms` is strictly less than the threshold are dropped before the limit truncation.
- `events` (array of `AuditEvent`): the matched events. The array is empty when no events fall in the window. Pinned as an array by `main.rs:5133-5136` — never null or a string.

The inner `AuditEvent` shape, defined at `agent-os/crates/noren-audit/src/lib.rs:45`:

- `id` (string) — event UUID.
- `timestamp_ms` (u64) — Unix-epoch milliseconds when the event was recorded.
- `issuer` (object) — `{display: string, pubkey: string (base58)}` per the `AgentId` Serialize impl at `noren-types/src/lib.rs:177`.
- `kind` (object) — tagged-enum `AuditKind` (defined at `noren-audit/src/lib.rs:153` onwards) with a `type` discriminator (e.g., `"capability_granted"`, `"intent_dispatched"`, `"hermes_tool_invoked"`) and variant-specific extra fields. Consumers must route on `kind.type` before reading variant-specific fields.

Top-level keys are pinned to exactly these four by the test at `agent-os/crates/noren/src/main.rs:5108` (`audit_recent_json_pins_top_level_schema`), exercised against three cases: populated with `since_ms`, empty with `since_ms`, and empty without `since_ms`.

The envelope source-of-truth lives at `audit_recent_json` in `agent-os/crates/noren/src/main.rs:3140`. Two unit tests at `main.rs:5081` (`audit_recent_json_renders_stable_shape`) and `main.rs:5108` cover the shape. The CLI verb is wired at `main.rs:1103-1173`; without `--json`, the same response is rendered as JSONL (one `AuditEvent` per line at `main.rs:1166`) mirroring the durable `audit/events.jsonl` row shape, with `(no audit events)` printed at `main.rs:1163` when empty. The optional `--stream` flag sets `Request::RecentAudit.prefer_stream = Some(true)` (`main.rs:1133`), enabling the v2 streaming-response path documented under [docs/protocol-versioning.md](./protocol-versioning.md); the terminal-response shape is unchanged when the streaming path is not selected.

`noren audit purge --json` emits a summary of time-bounded audit-log garbage collection. Envelope shape:

- `kind`: literal string `"audit_purged"`. Pinned at the value level by `main.rs:5065` (asserts `value["kind"].as_str() == Some("audit_purged")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `before_ms` (u64): resolved Unix-epoch millisecond cutoff. The CLI accepts `--before-ms` or `--older-than-ms` with the same resolution semantics as `noren capabilities purge --json` above. Pinned as u64 by `main.rs:5066-5069` — never a string-of-integer.
- `purged` (u64): count of audit events removed (the unsuffixed CLI message at `main.rs:1233` reads `purged <n> event(s)`, confirming the unit is an audit event, not a row class). May legitimately be `0` when no rows matched. Pinned as u64 by `main.rs:5070-5073` — never a string-of-integer.

Unlike the capability- and peer-purge verbs, this removes hash-chain entries; the cutoff enforcement is bound to the `audit.purge` capability scope at dispatch time so a delegated caller cannot purge beyond its scope's `before_ms` (see `docs/capabilities.md`).

Top-level keys are pinned to exactly these three by the test at `agent-os/crates/noren/src/main.rs:5049` (`audit_purge_json_pins_top_level_schema`).

The envelope source-of-truth lives at `audit_purge_json` in `agent-os/crates/noren/src/main.rs:3132`. Two unit tests at `main.rs:5041` (`audit_purge_json_renders_stable_shape`) and `main.rs:5049` cover the populated (`purged=3`) and empty (`purged=0`) cases. The CLI verb is wired at `main.rs:1197-1239`.

`noren audit verify --json` emits the audit-log hash-chain integrity report. Envelope shape:

- `kind`: literal string `"audit_integrity"` — past-tense outcome name, distinct from the verb name `verify` and from the workspace-level `verify_report` envelope; consumers routing on `kind` must match this literal exactly rather than reusing either of those tokens. Pinned at the value level by `main.rs:5202` (asserts `value["kind"].as_str() == Some("audit_integrity")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `report` (object): a structured `noren_audit::AuditIntegrityReport`, never a string blob. The top-level object has exactly two keys (`kind` and `report`); the inner `report` is pinned by the schema test at `main.rs:5203-5206` to be a JSON object.

The inner `AuditIntegrityReport` shape, defined at `agent-os/crates/noren-audit/src/lib.rs:63`:

- `events` (u64) — total audit events the integrity walk visited.
- `anchors` (u64) — count of anchor records (root-hash checkpoints) the walk crossed.
- `valid` (bool) — `true` when the hash chain is intact end-to-end; `false` when one or more failures were recorded.
- `root_hash_hex` (string) — the final root hash as lowercase hex, 64 characters (SHA-256). Pinned at the length level by the stable-shape test at `main.rs:5172-5178`.
- `failures` (array of strings) — human-readable failure descriptions (e.g., `"chain hash mismatch at event 3"`), empty when `valid` is `true`. The empty case is pinned by the stable-shape test at `main.rs:5179-5182` (asserts `as_array().map(Vec::len) == Some(0)`).

Top-level keys are pinned to exactly these two by the test at `agent-os/crates/noren/src/main.rs:5186` (`audit_verify_json_pins_top_level_schema`), exercised against both a valid and an invalid report.

The envelope source-of-truth lives at `audit_verify_json` in `agent-os/crates/noren/src/main.rs:3153`. Two unit tests at `main.rs:5158` (`audit_verify_json_renders_stable_shape`) and `main.rs:5186` cover the shape. The CLI verb is wired at `main.rs:1174-1196`; without `--json`, the same response is printed as the bare `AuditIntegrityReport` JSON (no envelope wrapper) at `main.rs:1190`, so JSON consumers must use `--json` to get the kind-discriminated envelope — the unsuffixed output is structurally compatible with `report` but lacks the `kind` field.

`noren memory purge --json` emits a summary of time-bounded memory-store garbage collection. Envelope shape:

- `kind`: literal string `"memory_purged"`. Pinned at the value level by `main.rs:5257` (asserts `value["kind"].as_str() == Some("memory_purged")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `tier` (string or null): the memory tier slug — exactly one of `"working"`, `"episodic"`, or `"longterm"` (one word, per `memory_tier_slug` at `main.rs:1702-1707`). Null when `--tier` was omitted, meaning the purge applied to all tiers. Note an input-form asymmetry: the CLI parser at `main.rs:1712-1714` accepts `longterm`, `long-term`, and `long_term` for the `--tier` argument, but only the `longterm` slug is ever emitted in the envelope. Pinned as string-or-null by `main.rs:5258-5261` — never a structured object.
- `before_ms` (u64): resolved Unix-epoch millisecond cutoff. Same `--before-ms` / `--older-than-ms` resolution semantics as `noren capabilities purge --json` above. Pinned as u64 by `main.rs:5262-5265` — never a string-of-integer.
- `purged` (u64): count of memory records removed. The unsuffixed CLI prints `purged <n> record(s)` at `main.rs:853`, confirming the unit is a memory record. May legitimately be `0` when no rows matched. Pinned as u64 by `main.rs:5266-5269` — never a string-of-integer.

Top-level keys are pinned to exactly these four by the test at `agent-os/crates/noren/src/main.rs:5241` (`memory_purge_json_pins_top_level_schema`), which also exercises the null-tier case.

The envelope source-of-truth lives at `memory_purge_json` in `agent-os/crates/noren/src/main.rs:3160`. Two unit tests at `main.rs:5229` (`memory_purge_json_renders_stable_shape`, both a Working-tier populated case and a no-tier null case) and `main.rs:5241` cover the populated and empty (`purged=0`, no-tier) cases. The CLI verb is wired at `main.rs:179-230`.

`noren memory recent [--tier <T>] [-n|--limit <N>] [--stream] --json` and `noren memory search <query> [--tier <T>] [-n|--limit <N>] [--min-relevance <R>] --json` both emit the same memory-read envelope, distinguished only by the `mode` discriminator. Envelope shape:

- `kind`: literal string `"memory_read"`. Pinned at the value level by `main.rs:5557` (asserts `value["kind"].as_str() == Some("memory_read")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `mode` (string): exactly one of `"recent"` or `"search"` (lowercase, matching the CLI verb name — no other values are emitted). Consumers must route on `mode` to know which null pattern to expect across `query` and `min_relevance`. Pinned as a string by `main.rs:5558` — never an object or array.
- `tier` (string or null): the requested `MemoryTier` as its lowercase wire slug — exactly one of `"working"`, `"episodic"`, or `"longterm"` (one word, per `MemoryTier`'s `#[serde(rename_all = "lowercase")]` at `noren-types/src/lib.rs:23` and the slug map at `memory_tier_slug` in `main.rs:1702-1707`). The CLI parser accepts `longterm`, `long-term`, and `long_term` as input forms for `--tier`, but only the `longterm` slug is ever emitted. `null` when `--tier` was omitted (meaning the request applied to all tiers). Pinned as string-or-null by the schema test (`main.rs:5563-5566`) — never a structured object.
- `limit` (u64): the request limit echoed back from `-n`/`--limit` (default `10` for both verbs, per `main.rs:147` and `main.rs:2476`). Pinned as u64 at the schema test (`main.rs:5559-5562`).
- `query` (string or null): for `mode="search"`, the request query (whitespace-joined when the operator passed multiple positional tokens, per `main.rs:2962`). For `mode="recent"`, always `null` (the recent verb does not accept a query). Pinned as string-or-null by the schema test (`main.rs:5567-5570`).
- `min_relevance` (number or null): for `mode="search"`, the float echoed from `--min-relevance` (validated to a finite `f32` in `[0.0, 1.0]` at `main.rs:2942-2946`), or `null` when the flag was omitted. For `mode="recent"`, always `null`. Pinned as f64-or-null by the schema test (`main.rs:5571-5574`) — never a string.
- `records` (array of `MemoryRecord`): the matched records in the order returned by the daemon. The array is empty when no records match; the unsuffixed CLI prints `(no records)` for that case at `main.rs:1608`. Pinned as an array by `main.rs:5575-5578` — never null or a string.

The inner `MemoryRecord` shape, defined at `agent-os/crates/noren-types/src/lib.rs:236`:

- `id` (string) — record UUID, serialized as the canonical hyphenated string form.
- `tier` (string) — lowercase `MemoryTier` slug (same enumeration as the top-level `tier` above; always present, never null).
- `owner` (object) — `{display: string, pubkey: string (base58)}` per the `AgentId` Serialize impl at `noren-types/src/lib.rs:177`.
- `text` (string) — the stored memory text.
- `embedding` (array of numbers) — the record's embedding vector as a JSON array of f32 values. The array is always present (empty when no embedding was attached); consumers must not assume the field is omitted.
- `metadata` (JSON value) — an arbitrary `serde_json::Value` (object, array, primitive, or null). The daemon emits whatever metadata the writer attached; consumers must not assume an object shape.
- `created_at` (u64) — Unix-epoch milliseconds when the record was written.
- `parent` (string or null) — parent record UUID for derived memories. Carries `#[serde(default)]` at `noren-types/src/lib.rs:245-246` **without** `skip_serializing_if`, so the field is **always emitted** (as `null` when the record has no parent), not omitted. JSON consumers must read it with null-vs-value, not key-existence.

Top-level keys are pinned to exactly these seven by the test at `agent-os/crates/noren/src/main.rs:5533` (`memory_read_json_pins_top_level_schema`), exercised against both a `mode="search"` case (populated `query`, `min_relevance`, non-empty `records`) and a `mode="recent"` case (null `query`, null `min_relevance`, empty `records`).

The envelope source-of-truth lives at `memory_read_json` in `agent-os/crates/noren/src/main.rs:3188`. Two unit tests at `main.rs:5490` (`memory_read_json_renders_stable_shape`) and `main.rs:5533` cover both modes. The CLI verbs are wired at `main.rs:145-2102` (`noren memory recent`) and `main.rs:2470-2895` (`noren memory search`); without `--json`, each record prints as `[<created_at>] <tier>: <text>` at `main.rs:1612`. The optional `--stream` flag is accepted only by `noren memory recent` (per `main.rs:178`) and sets `Request::RecentMemory.prefer_stream = Some(true)` to enable the v2 streaming-response path documented under [docs/protocol-versioning.md](./protocol-versioning.md); the terminal envelope shape is unchanged when the streaming path is not selected. `noren memory search` has no `--stream` flag.

`noren a2a status [-n|--limit <N>] [--min-lease-age-ms <N>] [--deadline-within-ms <N>] [--state queued|in_flight] --json` emits the current A2A queue snapshot — queued tasks, in-flight leases, and pending results — narrowed by the supplied filters. Envelope shape:

- `kind`: literal string `"a2a_status"`. Pinned at the value level by `main.rs:6128` (asserts `value["kind"].as_str() == Some("a2a_status")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `limit` (u64): the request limit echoed back from `-n`/`--limit` (default `10`, per `main.rs:2037`). Pinned as u64 by the schema test (`main.rs:6129-6132`).
- `min_lease_age_ms` (u64 or null): the threshold echoed from `--min-lease-age-ms`, or `null` when the flag was omitted. Always emitted (as `null` when inactive) — never omitted from the envelope. Pinned as u64-or-null by the schema test (`main.rs:6133-6136`).
- `deadline_within_ms` (u64 or null): the threshold echoed from `--deadline-within-ms`, or `null` when the flag was omitted. Same always-emitted-as-null contract as `min_lease_age_ms`. Pinned as u64-or-null by the schema test (`main.rs:6137-6140`).
- `state_filter` (string or null): the `A2ATaskQueueState` slug echoed from `--state` — exactly `"queued"` or `"in_flight"` (snake_case, per `A2ATaskQueueState`'s `#[serde(rename_all = "snake_case")]` at `noren-a2a/src/lib.rs:127-132`), or `null` when the flag was omitted. Pinned as string-or-null by the schema test (`main.rs:6141-6144`) — never an integer or array. Consumers must route on the lowercase wire form, **not** the Rust TitleCase names (`"Queued"`, `"InFlight"`).
- `tasks` (array of `A2ATaskQueueEntry`): the matched queue entries in the order returned by the daemon. The array may be empty. Pinned as an array by `main.rs:6145` — never null or a string blob.
- `results` (array of `A2ATaskResult`): pending results not yet acknowledged. The array may be empty; the unsuffixed CLI prints `(a2a queue empty)` at `main.rs:2102` when both `tasks` and `results` are empty. Pinned as an array by `main.rs:6146-6149` — never null or a string.

The inner `A2ATaskQueueEntry` shape, defined at `agent-os/crates/noren-a2a/src/lib.rs:135`:

- `state` (string) — `A2ATaskQueueState` slug, exactly `"queued"` or `"in_flight"` (same enumeration as the top-level `state_filter`). The canonical signal for queue-state branching — **not** lease-field presence.
- `task` (object) — nested `A2ATask` (see below).
- `lease_id` (string, omitted when null) — UUID of the active lease. Carries `#[serde(default, skip_serializing_if = "Option::is_none")]` at `noren-a2a/src/lib.rs:138-139`, so the key is **absent** when the entry is not leased.
- `leased_to` (object, omitted when null) — `AgentId` of the leaseholder. Same skip-when-absent contract.
- `leased_at_ms` (u64, omitted when null) — Unix-epoch milliseconds when the lease was taken. Same skip-when-absent contract.
- `attempt` (u32) — delivery attempt counter (always emitted; `0` for a fresh queue entry per `#[serde(default)]` at `noren-a2a/src/lib.rs:144-145`).

The nested `A2ATask` shape, defined at `agent-os/crates/noren-a2a/src/lib.rs:112`:

- `id` (string) — task UUID.
- `sender` (object) — `AgentId` `{display, pubkey}` per the form documented in the `peer_list` block.
- `recipient` (object) — `AgentId` of the routed-to peer.
- `intent_text` (string) — the task body.
- `task_kind` (string, omitted when null) — optional task-kind label; `skip_serializing_if = "Option::is_none"`.
- `parent` (string, omitted when null) — optional parent task UUID; same skip contract.
- `deadline_ms` (u64, omitted when null) — optional deadline (Unix-epoch ms); same skip contract.
- `idempotency` (object, omitted when null) — optional `A2AIdempotency` `{duplicate_safety: "unsafe"|"idempotent", key: string}` (defined at `noren-a2a/src/lib.rs:58-62`); same skip contract.

The inner `A2ATaskResult` shape, defined at `agent-os/crates/noren-a2a/src/lib.rs:390`:

- `task_id` (string) — the task UUID this result binds to.
- `status` (string) — `A2ATaskStatus` slug, exactly one of `"ok"`, `"error"`, `"partial"` (snake_case per `noren-a2a/src/lib.rs:43-49`). Consumers must route on the lowercase wire form, **not** the Rust TitleCase names.
- `content` (array of `Content`) — the same tagged-enum `Content` shape (`{type: "text", text: <string>}` or `{type: "json", value: <JSON>}`) already documented in the `tool_result` block above; empty for `error` results per `A2ATaskResult::error` at `noren-a2a/src/lib.rs:409-416`.
- `error_message` (string, omitted when null) — diagnostic message for `error` results; `skip_serializing_if = "Option::is_none"` per `noren-a2a/src/lib.rs:395-396`. Absent on `ok` and `partial` results.

Top-level keys are pinned to exactly these seven by the test at `agent-os/crates/noren/src/main.rs:6104` (`a2a_status_json_pins_top_level_schema`), exercised against both a populated-filters case and an all-null-filters case.

The envelope source-of-truth lives at `a2a_status_json` in `agent-os/crates/noren/src/main.rs:3319`. Three unit tests at `main.rs:6053` (`a2a_status_json_renders_stable_shape`), `main.rs:6095` (`a2a_status_json_omits_deadline_filter_when_inactive`, which pins the always-emitted-as-null contract on the filter fields), and `main.rs:6104` cover the shape. The CLI verb is wired at `main.rs:1255-1340`; without `--json`, the same response is rendered as JSONL with each task printed as `{"type": "task", "entry": <A2ATaskQueueEntry>}` and each result as `{"type": "result", "result": <A2ATaskResult>}` (per `main.rs:1323-1334`) — a different envelope shape than `--json`, so JSON consumers must use `--json` to get the kind-discriminated envelope.

`noren a2a retry-stale [--enable] [--min-lease-age-ms <N>] [--max-attempts <N>] [--max-requeues <N>] [--scan-limit <N>] --json` emits a per-call report describing what the auto-retry scan considered, requeued, and skipped. Envelope shape:

- `kind`: literal string `"a2a_auto_retry"`. Pinned at the value level by `main.rs:5005` (asserts `value["kind"].as_str() == Some("a2a_auto_retry")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `report` (object): a structured `A2AAutoRetryReport` (defined at `agent-os/crates/noren-a2a/src/lib.rs:291`), never a string blob. The top-level object has exactly two keys (`kind` and `report`); the inner `report` is pinned by the schema test at `main.rs:5006-5009` to be a JSON object.

**Dry-run by default**: `A2AAutoRetryPolicy.enabled` defaults to `false` (per `Default for A2AAutoRetryPolicy` at `noren-a2a/src/lib.rs:231-241`), and the CLI's `--enable` flag is the only path that flips it (`main.rs:1443`). On a `--json` call without `--enable`, every queue entry will appear under `skipped[]` with `reason: "disabled"` and the registry will not be mutated — a `requeued=0` result there is **not** a "nothing to retry" signal. Consumers analysing the report must read `report.policy.enabled` before drawing conclusions about whether `considered` minus `requeued.len()` indicates real skip pressure or a dry-run preview.

The inner `A2AAutoRetryReport` shape:

- `policy` (object) — the `A2AAutoRetryPolicy` echoed from the request (see below).
- `considered` (u64) — number of in-flight queue entries the scan evaluated. Bounded by `policy.scan_limit`.
- `requeued` (array of `A2AAutoRetryRequeued`) — entries the scan successfully requeued under the policy. Empty when the policy is disabled or when no candidate met the requeue criteria. Carries `#[serde(default)]` on the deserialization side (`noren-a2a/src/lib.rs:294-295`); the serializer always writes the array.
- `skipped` (array of `A2AAutoRetrySkipped`) — entries the scan considered but did not requeue, each with a typed skip reason. Same `#[serde(default)]` contract.

The inner `A2AAutoRetryPolicy` shape, defined at `noren-a2a/src/lib.rs:218`:

- `enabled` (bool) — see the dry-run note above.
- `min_lease_age_ms` (u64) — minimum lease age before an in-flight entry is eligible for auto-requeue.
- `max_attempts` (u32) — per-entry attempt ceiling.
- `max_requeues` (u64) — per-call requeue ceiling (`usize` on the Rust side; serialized as a JSON integer).
- `scan_limit` (u64) — per-call scan size cap (`usize` on the Rust side).

The inner `A2AAutoRetryRequeued` shape, defined at `noren-a2a/src/lib.rs:283`:

- `task_id` (string) — task UUID.
- `lease_id` (string) — the lease UUID that was preempted by the requeue.
- `attempt` (u32) — the attempt counter before the requeue (the requeued entry will resurface with `attempt+1`).
- `idempotency_key` (string) — the idempotency key that bound this task's delivery — present because `unsafe_duplicate_safety` is one of the documented skip reasons, so only safely-bound tasks reach `requeued[]`.

The inner `A2AAutoRetrySkipped` shape, defined at `noren-a2a/src/lib.rs:274`:

- `task_id` (string) — task UUID.
- `reason` (string) — `A2AAutoRetrySkipReason` slug (see enumeration below).
- `attempt` (u32) — the entry's current attempt counter.
- `lease_age_ms` (u64, omitted when null) — observed lease age in milliseconds. Carries `#[serde(default, skip_serializing_if = "Option::is_none")]` at `noren-a2a/src/lib.rs:278-279`, so the key is **absent** when the skip happened before any lease age was meaningful (e.g. `reason: "disabled"` or `reason: "not_in_flight"`). JSON consumers must read it with key-existence, not null-vs-value.

`A2AAutoRetrySkipReason` enumerates exactly these nine snake_case slugs (per `noren-a2a/src/lib.rs:243-255`):

- `"disabled"` — `policy.enabled = false`; emitted for every considered entry on a dry-run call.
- `"not_in_flight"` — entry is queued rather than leased.
- `"missing_lease"` — entry state is `in_flight` but the lease record is absent.
- `"lease_too_young"` — lease age is below `policy.min_lease_age_ms`.
- `"missing_idempotency"` — task carries no `A2AIdempotency` binding.
- `"unsafe_duplicate_safety"` — task's idempotency binding declares `duplicate_safety: "unsafe"`.
- `"max_attempts_reached"` — entry has hit `policy.max_attempts`.
- `"limit_reached"` — this call has already requeued `policy.max_requeues` entries.
- `"capability_scope_mismatch"` — the caller's signed capability scope does not authorise requeue on this task.

Consumers must route on the lowercase wire form, **not** the Rust TitleCase names (`"Disabled"`, `"NotInFlight"`, etc.) — those never appear on the wire.

Top-level keys are pinned to exactly these two by the test at `agent-os/crates/noren/src/main.rs:4989` (`a2a_retry_json_pins_top_level_schema`), exercised against both a populated (requeued + skipped) case and an empty (fresh policy) case.

The envelope source-of-truth lives at `a2a_retry_json` in `agent-os/crates/noren/src/main.rs:3338`. Two unit tests at `main.rs:4952` (`a2a_retry_json_renders_stable_shape`) and `main.rs:4989` cover the shape. The CLI verb is wired at `main.rs:1430-1486`; without `--json`, the same response prints `considered <N> task(s), requeued <M>, skipped <K>` followed by `automatic retry disabled; pass --enable to mutate` whenever `report.policy.enabled` is `false` (per `main.rs:1472-1480`).

`noren a2a compact --json` emits a summary of the event-log compaction that drops lines for fully-resolved A2A tasks. Envelope shape:

- `kind`: literal string `"a2a_compacted"` — past-tense outcome name, distinct from the verb name `compact`; consumers routing on `kind` must match the literal exactly rather than reusing the verb token (`"a2a_compact"`) or guessing a noun form (`"a2a_compaction"`). Pinned at the value level by `main.rs:4940` (asserts `value["kind"].as_str() == Some("a2a_compacted")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `dropped` (u64): count of event-log lines removed for resolved tasks. May legitimately be `0` when no resolved tasks remain — the unsuffixed CLI still prints `dropped 0 a2a event(s)` at `main.rs:1503`, and JSON consumers must not treat `dropped=0` as an error. Pinned as u64 by `main.rs:4941-4944` — never a string-of-integer.

Top-level keys are pinned to exactly these two by the test at `agent-os/crates/noren/src/main.rs:4924` (`a2a_compact_json_pins_top_level_schema`), exercised against both a populated (`dropped=3`) and an empty (`dropped=0`) case.

The envelope source-of-truth lives at `a2a_compact_json` in `agent-os/crates/noren/src/main.rs:3125`. Two unit tests at `main.rs:4917` (`a2a_compact_json_renders_stable_shape`) and `main.rs:4924` cover the shape. The CLI verb is wired at `main.rs:1487-1509`; without `--json`, the same response prints `dropped <N> a2a event(s)` at `main.rs:1503`.

`noren memory compact --reason <text> [--apply] [--detach-stale-parents] [--delete-working-before-ms <M> | --delete-working-older-than-ms <D>] [--delete-episodic-before-ms <M> | --delete-episodic-older-than-ms <D>] [--mark-longterm-stale-before-ms <M> | --mark-longterm-stale-older-than-ms <D>] [--marked-at-ms <M>] --json` emits the outcome of a memory-store compaction pass. Envelope shape:

- `kind`: literal string `"memory_compacted"` — past-tense outcome name, distinct from the verb name `compact`; consumers routing on `kind` must match the literal exactly rather than reusing the verb token (`"memory_compact"`) or guessing a noun form (`"memory_compaction"`). Pinned at the value level by `main.rs:5325` (asserts `value["kind"].as_str() == Some("memory_compacted")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `outcome` (object): a structured `MemoryCompactionOutcome` (defined at `agent-os/crates/noren-types/src/lib.rs:350`), never a string blob. The top-level object has exactly two keys (`kind` and `outcome`); the inner `outcome` is pinned by the schema test at `main.rs:5326-5329` to be a JSON object.

**Dry-run by default, mutates only with `--apply`**: the CLI defaults to `MemoryRepairMode::DryRun` (per `main.rs:952-960`) and `--reason <text>` is mandatory regardless of mode (the CLI bails with `"missing --reason"` at `main.rs:959` when omitted). Without `--apply`, the daemon evaluates the policy and reports what *would* change but does not mutate the store.

The inner `MemoryCompactionOutcome` shape:

- `mode` (string) — `MemoryRepairMode` slug, exactly `"dry_run"` or `"apply"` (snake_case, per `MemoryRepairMode`'s `#[serde(rename_all = "snake_case")]` at `noren-types/src/lib.rs:249-254`). Consumers must route on the lowercase wire form, **not** the Rust TitleCase names.
- `would_change` (bool) — the policy identified at least one mutation that would land. Reliable in both modes — `true` whenever the policy matched records.
- `changed` (bool) — the store was actually mutated by this call. In `mode: "dry_run"` this is **always `false`** even when `would_change` is `true`; only `mode: "apply"` can set it. JSON consumers branching on `changed` alone will silently treat dry-run planning runs as no-ops; route on the `(mode, would_change, changed)` triple instead.
- `deleted` (array of strings) — UUIDs of records the policy deleted (in `apply` mode) or would delete (in `dry_run` mode). The empty-case is pinned by the stable-shape test at `main.rs:5296-5299` (asserts `value["outcome"]["deleted"].as_array().map(Vec::len) == Some(0)`).
- `stale_marked` (array of strings) — UUIDs of long-term records the policy marked stale (or would mark, in dry-run mode).
- `parents_detached` (array of strings) — UUIDs of records whose parent pointer the policy detached (or would detach, when `--detach-stale-parents` is supplied). The empty-case is pinned by the stable-shape test at `main.rs:5300-5305` (asserts `value["outcome"]["parents_detached"].as_array().map(Vec::len) == Some(0)`).

Top-level keys are pinned to exactly these two by the test at `agent-os/crates/noren/src/main.rs:5309` (`memory_compaction_json_pins_top_level_schema`), exercised against both a populated `apply` case and an empty `dry_run` case.

The envelope source-of-truth lives at `memory_compaction_json` in `agent-os/crates/noren/src/main.rs:3169`. Two unit tests at `main.rs:5281` (`memory_compaction_json_renders_stable_shape`) and `main.rs:5309` cover the shape. The CLI verb is wired at `main.rs:231-339` (shared with `noren memory plan-compaction`; the `plan-compaction` arm forces dry-run and emits a different envelope documented below).

`noren memory plan-compaction --reason <text> [--detach-stale-parents] [--delete-working-before-ms <M> | --delete-working-older-than-ms <D>] [--delete-episodic-before-ms <M> | --delete-episodic-older-than-ms <D>] [--mark-longterm-stale-before-ms <M> | --mark-longterm-stale-older-than-ms <D>] [--marked-at-ms <M>] --json` emits a read-only compaction plan. The verb shares its argument parser with `noren memory compact` but is forced into dry-run mode. Envelope shape:

- `kind`: literal string `"memory_compaction_plan"` — distinct from `memory_compacted` so consumers can route on the planning vs mutating outcome without inspecting `outcome.mode`. Pinned at the value level by `main.rs:5394` (asserts `value["kind"].as_str() == Some("memory_compaction_plan")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `outcome` (object): the same `MemoryCompactionOutcome` shape documented in the `memory_compacted` block above. For this verb, `outcome.mode` is **always** `"dry_run"` and `outcome.changed` is **always** `false`; a non-`dry_run` value here indicates daemon/CLI drift and JSON consumers should treat it as a protocol violation. Pinned as a structured object by `main.rs:5395-5398` — never a string blob.
- `expected_receipt_changes` (object): a forward-compatibility placeholder pinned by the schema test at `main.rs:5427` (`memory_compaction_plan_json_pins_expected_receipt_changes_schema`). The block has exactly three keys today and is currently a no-claim stub; consumers must validate the inner shape rather than dispatch directly to apply-mode logic. Pinned as a structured object by `main.rs:5399-5402` — never a string blob.

**`--apply` is rejected** at the CLI level (`main.rs:2169-242`: `bail!("memory plan-compaction is read-only and does not accept --apply")`) even though the underlying `Request::CompactMemory` request accepts both modes. `--reason <text>` remains mandatory, matching the `memory compact` verb.

The inner `expected_receipt_changes` shape:

- `mode` (string): literal `"none"` today. Pinned by the schema test at `main.rs:5446-5450` as the only currently-allowed value; consumers must treat any other value as a sign that receipt-aware compaction has shipped and the docs are stale. Pinned as a string by `main.rs:5442-5445` — never a structured object.
- `records` (array): empty today (length pinned to `0` at `main.rs:5455-5461`). Will gain a real shape once receipt-aware compaction lands. Pinned as an array by `main.rs:5451-5454` — never null or a string. The renders-test sibling at `main.rs:5369-5374` independently pins the same empty-case `expected_receipt_changes.records` assertion (`as_array().map(Vec::len) == Some(0)`).
- `reason` (string): a human-readable explanation of why the block is empty. Currently the literal `"dry-run compaction planning does not mutate memory or settlement receipts"` per `main.rs:2465`; consumers must not branch on the exact text — only on the field's existence and type. Pinned as a string by `main.rs:5462-5465` — never a structured object.

Top-level keys are pinned to exactly these three by the test at `agent-os/crates/noren/src/main.rs:5378` (`memory_compaction_plan_json_pins_top_level_schema`), exercised against both a populated dry-run case and an empty dry-run case.

The envelope source-of-truth lives at `memory_compaction_plan_json` in `agent-os/crates/noren/src/main.rs:3176`. Three unit tests at `main.rs:5354` (`memory_compaction_plan_json_renders_stable_shape`), `main.rs:5378` (`memory_compaction_plan_json_pins_top_level_schema`), and `main.rs:5427` (`memory_compaction_plan_json_pins_expected_receipt_changes_schema`) cover both the outer envelope and the placeholder block. The CLI verb is wired at `main.rs:231-339` (shared parser with `noren memory compact`, branched into the plan-only path at `main.rs:232`); the `plan-compaction` arm sets `as_json` to `true` by default (`main.rs:236`) so the unsuffixed CLI also emits the JSON envelope — there is no human-readable plan rendering.

`noren ignore check <text> --json` emits the result of evaluating the configured ignore rules against operator-supplied text. Envelope shape:

- `kind`: literal string `"ignore_report"`. Pinned at the value level by `main.rs:5636` (asserts `value["kind"].as_str() == Some("ignore_report")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `ignored` (boolean): `true` when at least one loaded rule matched the supplied text; `false` otherwise. Pinned as a JSON boolean by the schema test (`main.rs:5637-5640`) — never `0`/`1` or a string-truthy value.
- `matched_pattern` (string or null): the matched rule pattern when `ignored` is `true`; **always `null`** when `ignored` is `false`. Pinned as string-or-null by the schema test (`main.rs:5641-5644`) — never an empty string for the unmatched case. JSON consumers must use `null` (not `""`) as the unmatched discriminator.
- `rules_loaded` (u64): count of ignore rules the daemon evaluated. May legitimately be `0` when no rules are configured, in which case `ignored` is always `false` and `matched_pattern` is always `null`. Pinned as u64 by `main.rs:5645-5648` — never a string-of-integer.

**Exit-code coupling**: when `ignored` is `true`, the CLI exits `1` even in the `--json` path (per `main.rs:2745-2747`); the envelope is written to stdout *before* the exit. JSON consumers running this verb to gate downstream processing must read the envelope rather than relying solely on transport success — a `--json` invocation that exits `1` is the **expected** signal for a matched ignore rule, not an error.

Top-level keys are pinned to exactly these four by the test at `agent-os/crates/noren/src/main.rs:5620` (`ignore_report_json_pins_top_level_schema`), exercised against both an `ignored=true` case with a non-null `matched_pattern` and an `ignored=false` case with a null `matched_pattern` and zero `rules_loaded`.

The envelope source-of-truth lives at `ignore_report_json` in `agent-os/crates/noren/src/main.rs:3207`. Two unit tests at `main.rs:5608` (`ignore_report_json_renders_stable_shape`) and `main.rs:5620` cover the shape. The CLI verb is wired at `main.rs:2704-2752`; without `--json`, the matched case prints `ignored — matched rule: <pattern>` at `main.rs:2741` and the unmatched case prints `not ignored (<n> rule(s) loaded)` at `main.rs:2743`. Both paths share the exit-1-when-ignored convention.

`noren bootstrap --json` emits a summary of the capability-bootstrap pass that grants every action required by manifests under `$NOREN_HOME/agents/*/agent.toml` (plus the implicit `memory.write`, which the daemon writes on every successful dispatch). Envelope shape:

- `kind`: literal string `"bootstrap_result"`. Pinned at the value level by `main.rs:4425` (asserts `value["kind"].as_str() == Some("bootstrap_result")`), so a future kind-rename fails the test rather than silently rewriting the discriminator string.
- `granted` (array of `{action: string, signature_b58: string}` objects): the capabilities **newly granted** during this bootstrap call. Each element echoes the action string and the daemon-signed base58 signature that authorises it. Pinned as an array by `main.rs:4426-4429` — never null or a string. The asymmetric inner shape — `granted` entries are objects, not bare strings — is pinned by `main.rs:4443-4446` (asserts `populated["granted"][0].is_object()`).
- `already_granted` (array of strings): the action names the daemon **already had** before this call. Note the asymmetry with `granted`: this field carries **bare action strings**, not the `{action, signature_b58}` object shape — the existing signatures are not echoed here. JSON consumers must not iterate `already_granted` as if it were objects. Pinned as an array by `main.rs:4430-4433` — never null or a string. The asymmetric inner shape — `already_granted` entries are bare strings, not objects — is pinned by `main.rs:4447-4450` (asserts `populated["already_granted"][0].is_string()`).

Top-level keys are pinned by the test at `agent-os/crates/noren/src/main.rs:4409` (`bootstrap_result_json_pins_top_level_schema`), exercised against a populated case (two newly-granted entries plus one already-granted entry), an empty-granted case (no new grants, two already-granted entries), and a fully-empty case. The test also asserts the asymmetric inner shape: `granted` entries are `{action, signature_b58}` objects while `already_granted` entries are bare action strings.

Re-running `noren bootstrap` is idempotent: if every required action is already granted, `granted` is empty and `already_granted` carries the full set. An empty `granted` array is the **expected** signal for "nothing to do" — not a transport failure. The empty-granted case must serialize as a JSON array (`[]`), not as `null` or an absent key; this invariant is pinned by `main.rs:4455-4458` (asserts `no_new_grants["granted"].as_array().unwrap().is_empty()`). The unsuffixed CLI prints `nothing to do — every required capability is already granted (<n> total)` at `main.rs:1930-1933` for that case.

The envelope source-of-truth lives at `bootstrap_result_json` in `agent-os/crates/noren/src/main.rs:3305`. Two unit tests at `main.rs:4386` (`bootstrap_result_json_renders_stable_shape`) and `main.rs:4409` cover the shape. The CLI verb is wired at `main.rs:1849-1952`; the JSON emission site calls the helper at `main.rs:1927-1928`. Required actions are derived from the union of every `agent.toml`'s `[capabilities].required` list (`main.rs:1865-1885`) plus the unconditional `memory.write` insertion (`main.rs:1867`). The daemon-side dispatch is `Request::GrantCapability` per action (`main.rs:1906-1913`); failures fall through to a `daemon error granting <action>: <message>` bail rather than into the envelope. Without `--json`, the same response prints `granted <n> of <m> capabilities to user@local:` followed by one `  + <friendly-title> (<action>)` line per newly-granted entry and a final `ready. try: noren intent "say hello"` (per `main.rs:1935-1950`).

`noren intents resume <intent-id|latest> --json` emits the outcome of resuming a previously-paused intent (typically one that hit a `BudgetExhausted` audit row). The envelope is **two-shape**: success and error share the same `kind` discriminator and use a flat `ok` boolean as the structural discriminator at the top level — **not** a tagged-enum `outcome.type` like `peer_revoke`. Consumers must branch on `ok` to know which key set to expect.

Both branches share these fields:

- `kind`: literal string `"intents_resume"` — verb-name asymmetry: the CLI verb is `resume` but the envelope discriminator is `intents_resume` (the noun-verb compound, not the verb token alone); consumers routing on `kind` must match the literal exactly. The same literal is emitted on both `ok=true` and `ok=false` envelopes. Pinned at the value level by `main.rs:4095` (success branch) and `main.rs:3938` (error branch) — each asserts `value["kind"].as_str() == Some("intents_resume")` — so a future kind-rename fails the tests rather than silently rewriting the discriminator string.
- `ok` (boolean): `true` on success, `false` on every error path. Pinned as a JSON boolean by the schema tests at `main.rs:4096-4099` and `main.rs:3939-3942` — never `0`/`1` or a string-truthy value. JSON consumers branching on `ok` alone get the correct outcome class without inspecting variant-specific fields. The error branch's invariant `ok=false` is also pinned at the value level by `main.rs:3943-3947` (asserts `value["ok"].as_bool() == Some(false)`), so a regression that emitted `ok=true` from the error envelope would fail at test time.
- `mode` (string): exactly `"explicit"` or `"latest"`, derived from the CLI invocation form at `main.rs:2614` (`--latest`/`latest` → `"latest"`, any positional intent-id → `"explicit"`). The envelope echoes the operator's input form, so consumers can distinguish a targeted resume from a "resume the most recent paused intent" call. Pinned as a string by `main.rs:4100` (success branch) and `main.rs:3948` (error branch) — never an object or array.

**Success branch (`ok=true`)** carries these eight top-level keys per the test EXPECTED_KEYS at `main.rs:4071-4080`:


- `intent_id` (string) — the resumed intent's UUID in canonical hyphenated form. Pinned as a string by `main.rs:4101-4104` — never a byte array.
- `status` (string) — the daemon-returned outcome status (typically `"ok"`). Pinned as a string by `main.rs:4105-4108` — never an object or array. Specific value enumeration lives with the daemon's intent dispatcher rather than this docs surface.
- `text` (string) — the result text the daemon returned for the resumed intent. The unsuffixed CLI prints this value directly at `main.rs:1844`. Pinned as a string by `main.rs:4109` — never an object or array.
- `sources` (array of strings) — source labels that contributed to the result. Pinned as an array of strings by `main.rs:4110-4113` — never a comma-joined string. Empty when no sources are attached; the unsuffixed CLI prints a `sources:` block followed by `  - <label>` lines at `main.rs:2666-2669` only when the array is non-empty.
- `settlement` (object or null) — an optional `SettlementReceipt` (defined at `agent-os/crates/noren-types/src/lib.rs:392` and documented in the `receipt_list` block above) carrying the on-chain or local settlement evidence when the resumed intent consumed credits. `null` when the resume did not settle. Pinned as object-or-null by `main.rs:4114-4117` — never an integer or array.

**Error branch (`ok=false`)** carries these five top-level keys per the test EXPECTED_KEYS at `main.rs:3923`:

- `intent_id` (string or null) — string-uuid when the intent_id was already resolved (e.g., the daemon round-trip started but returned an error, per `main.rs:2676-2681`); **null** when the intent_id could not be resolved before the daemon round-trip (e.g., `missing_intent_id` and `conflicting_flags` paths at `main.rs:2625-2633`). Pinned as string-or-null by `main.rs:3949-3952`. JSON consumers must accept `null` here rather than treating it as a malformed envelope.
- `error` (object): a structured `{code, message}` pair, never a string blob. Pinned as a JSON object by `main.rs:3953-3956`. The inner `error` object has exactly two keys per the test EXPECTED_KEYS at `main.rs:3976`:
  - `code` (string) — typed error slug (snake_case). Pinned as a string by `main.rs:3990-3993` — never a structured object. The recognised slugs from `intents_resume_error_code` at `main.rs:3352-3367` are `"no_budget_exhausted_row"`, `"missing_intent_id"`, `"invalid_intent_id"`, `"conflicting_flags"`, and the catch-all `"error"` for daemon messages that do not match a typed arm. Additionally, the inline emission paths add `"daemon_error"` (when the daemon returns `Response::Error`, `main.rs:2679`) and `"unexpected_response"` (when the daemon returns an unexpected response variant, `main.rs:2694`). Consumers must route on the documented slugs; new slugs are a forcing function to update this docs block and the `intents_resume_error_code_pins_documented_arms` test at `main.rs:3848`.
  - `message` (string) — the human-readable diagnostic the daemon or CLI produced. Pinned as a string by `main.rs:3994-3997` — never a structured object.

**Exit-code coupling**: the `--json` path exits `1` on every error branch (`main.rs:2634`, `main.rs:2683`, `main.rs:2698`); the envelope is written to stdout *before* the exit. JSON consumers gating downstream processing on transport success will silently miss resume failures — branch on `ok` rather than on exit `0`. Success exits `0` via the normal return at `main.rs:2661`. This mirrors the `peer_revoke` and `ignore_report` exit-coupling conventions documented above.

Top-level keys are pinned by three tests at `agent-os/crates/noren/src/main.rs`: `intents_resume_ok_json_pins_top_level_schema` at `main.rs:4070` (success branch, exercises both `Some(SettlementReceipt)` and `None` cases), `intents_resume_error_json_pins_top_level_schema` at `main.rs:3922` (error branch, exercises both `Some(intent_id)` and `None` cases), and `intents_resume_error_json_pins_error_object_schema` at `main.rs:3975` (inner `error` object's two-key shape). The typed-slug enumeration is pinned by `intents_resume_error_code_pins_documented_arms` at `main.rs:4016`.

The envelope source-of-truth lives at `intents_resume_ok_json` (`main.rs:3369`) and `intents_resume_error_json` (`main.rs:3389`), with the slug classifier at `intents_resume_error_code` (`main.rs:3352`). The CLI verb is wired at `main.rs:2593-2703`; without `--json`, the success branch prints the result `text` at `main.rs:1844` followed by an optional `sources:` block, and the error branches bail with the human-readable diagnostic — there is no envelope rendering, so JSON consumers must use `--json` to get the kind-discriminated envelope.

`noren settlement backfill-receipts [--dry-run] [--json]` emits a versioned-schema envelope describing the legacy settlement-receipt repair pass. **Schema-suffix convention**, not the unversioned `kind` convention every other envelope in this section uses — consumers route on `schema` rather than `kind`. The asymmetry is consistent with the section preamble (line 99): post-`noren.<area>.<verb>.v<n>` envelopes land with the suffix; only the older read-side envelopes carry the bare `kind` literal.

Envelope shape:

- `schema`: literal string `"noren.settlement.backfill.v1"`. The `.v1` suffix is the version slot; a future `.v2` would be a separate envelope, not a field rename inside this one. Consumers must route on the full literal — matching on the prefix `"noren.settlement.backfill."` will swallow incompatible future versions. Pinned as a string by `main.rs:4290-4293` — never an integer or object. The literal value `"noren.settlement.backfill.v1"` is also pinned at the value level by `main.rs:4294-4298` (asserts `value["schema"].as_str() == Some("noren.settlement.backfill.v1")`), so a future `.v2` bump fails the test rather than silently rewriting the schema string.
- `row_count` (u64): count of legacy settlement-receipt rows the backfill operated on (mutation path) or *would* operate on (dry-run path). May legitimately be `0` when no legacy rows match — the verb does not error on an empty backfill. Pinned as u64 by `main.rs:4299-4302` — never a string-of-integer.
- `rollback_path` (string or null): filesystem path to the rollback-evidence file written by a mutation pass; `null` in dry-run mode. The CLI's inline emission at `main.rs:2797` passes `rollback_path.as_deref()` through `Option<&str>`, and the unsuffixed CLI at `main.rs:2805-2807` maps `None` to the literal `(none)` — JSON consumers must use `null` (not `""` or `"(none)"`) as the unset discriminator. When non-null, the path is meaningful only on the daemon's local filesystem; remote consumers must not assume the file is reachable. Pinned as string-or-null by `main.rs:4303-4306` — never the literal `"(none)"`.
- `dry_run` (bool): echoes the `--dry-run` CLI flag. `true` is a safe planning preview that does not mutate the receipt table; `false` is a real mutation pass that may write rollback evidence. Pinned as a JSON boolean by `main.rs:4307-4310` — never `0`/`1` or a string.

**`--scope-pubkey` is reserved, not yet wired**: the CLI accepts a `--scope-pubkey <value>` flag and forwards it through `Request::BackfillSettlementReceipts.scope_pubkey` (`main.rs:2768-2773`, `main.rs:2782`), but the daemon-side filter is not yet implemented (see the help text at `main.rs:157` and the file-header CLI summary at `main.rs:24`). Operators relying on the flag for scoped backfills will not get the scoping behavior they expect; the envelope reports the unscoped result regardless. This will change when the approved `settlement-receipt-backfill-mutation` slice lands.

Top-level keys are pinned by the test at `agent-os/crates/noren/src/main.rs:4275` (`settlement_backfill_json_pins_top_level_schema`), exercised against both a dry-run shape (`rollback_path` null), a mutation shape (`rollback_path` set), and an empty-rows dry-run shape; the test also asserts the literal `"noren.settlement.backfill.v1"` schema string so a future v2 bump must land as a separate envelope, not a field rename inside this one.

The envelope source-of-truth lives at `settlement_backfill_json` in `agent-os/crates/noren/src/main.rs:3283`. Two unit tests at `main.rs:4253` (`settlement_backfill_json_renders_stable_shape`) and `main.rs:4275` cover the shape. The CLI verb is wired at `main.rs:2759-2813` (the `settlement backfill-receipts` subcommand); without `--json`, the same response prints `row_count: <N>`, `dry_run: <bool>`, and `rollback_path: <path>|(none)` on three separate lines at `main.rs:2802-2807`. The daemon-side `Response::SettlementReceiptsBackfilled` variant carries the three fields directly (`main.rs:2787-2791`); a future schema bump must propagate through the daemon variant, the CLI emitter, and this docs block as one atomic change.

`noren memory backfill-receipt-correlation [--dry-run] [--json]` emits a versioned-schema envelope describing the legacy memory-record-to-receipt correlation backfill pass. Sibling to `settlement.backfill.v1` above — both use the `noren.<area>.backfill.v<n>` convention and both share the `--scope-pubkey` reservation. The structural diff is the rollback channel: settlement uses a **filesystem** rollback file (`rollback_path`), memory uses a **SQLite SAVEPOINT** identifier (`savepoint_name`) so a future mutator can `ROLLBACK TO SAVEPOINT` within the same DB transaction.

Envelope shape:

- `schema`: literal string `"noren.memory.backfill.v1"`. Same versioning semantics as `noren.settlement.backfill.v1` — route on the full literal, not the prefix. Pinned as a string by `main.rs:4353-4356` — never an integer or object. The literal value `"noren.memory.backfill.v1"` is also pinned at the value level by `main.rs:4357-4361` (asserts `value["schema"].as_str() == Some("noren.memory.backfill.v1")`), so a future `.v2` bump fails the test rather than silently rewriting the schema string.
- `row_count` (u64): count of memory records the correlation pass operated on (mutation path) or *would* operate on (dry-run path). May legitimately be `0` when no legacy rows match. Pinned as u64 by `main.rs:4362-4365` — never a string-of-integer.
- `savepoint_name` (string): SQLite SAVEPOINT identifier the daemon emitted for this pass. **Always a non-null string** — the field type at `memory_backfill_json` (`main.rs:3296`) is `&str`, not `Option<&str>`, so even a dry-run call returns a real savepoint name (the daemon allocates one so consumers can correlate planning runs against later mutation runs). JSON consumers must not write null-vs-value branching for this field; treat absence as a protocol violation. This is the only field-shape difference from `settlement.backfill.v1`, whose sibling `rollback_path` is string-or-null. Pinned as a string by `main.rs:4366-4369` — never null (the &str emitter type forbids null at compile time). The non-empty invariant — savepoint_name is also never the empty string `""`, even on dry-run — is pinned by `main.rs:4370-4373` (asserts `!value["savepoint_name"].as_str().unwrap().is_empty()`).
- `dry_run` (bool): echoes the `--dry-run` CLI flag. Same semantics as `settlement.backfill.v1`'s `dry_run` — `true` is a planning preview, `false` is a real mutation pass. Pinned as a JSON boolean by `main.rs:4374-4377` — never `0`/`1` or a string.

**Verb-name asymmetry**: the CLI verb is the long form `memory backfill-receipt-correlation`, **not** `memory backfill` or `memory backfill-receipts` (which would mirror the settlement sibling's shorter name). The match arm is at `main.rs:1039`; the shorter spellings do not parse and return an `unknown flag` bail. JSON consumers driving the CLI from a wrapper must hard-code the long verb token.

**`--scope-pubkey` is reserved, not yet wired**: same caveat as `settlement.backfill.v1`. The CLI accepts the flag and forwards it through `Request::BackfillMemoryRecords.scope_pubkey` (`main.rs:1048-1053`, `main.rs:1062`), but the daemon-side filter is not yet implemented (see the help text at `main.rs:140` and the file-header CLI summary at `main.rs:12`). This will change when the approved `memory-record-receipt-backfill-mutation` slice lands.

Top-level keys are pinned by the test at `agent-os/crates/noren/src/main.rs:4338` (`memory_backfill_json_pins_top_level_schema`), exercised against a dry-run shape, a mutation shape, and an empty-rows dry-run shape; the test also asserts the literal `"noren.memory.backfill.v1"` schema string and the always-non-null, always-non-empty `savepoint_name` contract documented above.

The envelope source-of-truth lives at `memory_backfill_json` in `agent-os/crates/noren/src/main.rs:3296`. Two unit tests at `main.rs:4323` (`memory_backfill_json_renders_stable_shape`) and `main.rs:4338` cover the shape. The CLI verb is wired at `main.rs:1039-1090` (the `memory backfill-receipt-correlation` arm under the `memory` subcommand); without `--json`, the same response prints `row_count: <N>`, `dry_run: <bool>`, and `savepoint_name: <name>` on three separate lines at `main.rs:1082-1084`. The daemon-side `Response::MemoryRecordsBackfilled` variant carries the three fields directly (`main.rs:1067-1071`); a future schema bump must propagate through the daemon variant, the CLI emitter, and this docs block as one atomic change.


## Human Authority

The decision to bump the IPC/HTTP protocol, the wire shapes that change, the migration window, and the public release notes for v2 remain human-owned. Automation keeps this contract documented and validated; with the v2 `StreamEnvelope` fixtures landed under ADR 0010, the validator now runs in strict mode rather than dormant. It must not introduce v2 fixtures, edit `PROTOCOL_VERSION`, or relax the migration-note pairing without an approved decision.
