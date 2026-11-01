# Constitution Anchoring — v0.2 Calldata Memo, v0.3 Multisig

Status: design proposal for Robinhood Chain (chain id 4663). Not implemented in this repository.

## What this anchors

The `ConstitutionVerifier` mechanical lens (Ring 2 of Witness Loop v0.2) reads a ban-list of immutable repo invariants that the autonomous Modifier persona cannot rewrite. Examples:
- identity-token substring ban (operator-identifying tokens derived at runtime from `USER`, `HOME`, `hostname`, and `git config --global user.{name,email}` — same mechanism `hooks/pre-commit` already enforces; the ban-list file never enumerates the literal tokens, so reading it leaks nothing)
- autonomous-author hard rule (commits in autonomous mode must carry the Noren author identity declared in `agent-os/autonomy/commit-rotation.json`)
- `scaffold_mutation_scope` path allowlist (Modifier writes only `agent-os/agents/tools/**`, `agent-os/autonomy/tasks/**`)
- no-supervisor-modification (Modifier cannot edit `agent-os/scripts/handover.sh`, launchd plist files under `~/Library/LaunchAgents/org.noren.*.plist`)
- no-centralized-API-additions (Modifier cannot add network calls that route through a noren-operated centralized API surface)
- no-test-deletion (Modifier may extend tests; never remove or weaken assertions)

The verifier needs an anchor for "this is the current version of the ban-list" that the loop CANNOT silently rewrite. A flat file in the repo (`landing/public/constitution/ban-list.json`) is necessary but not sufficient — the loop could in principle edit that file. The anchor closes the loop.

## v0.2 — Calldata memo

**Protocol:** a zero-value transaction on Robinhood Chain (4663) whose calldata carries the memo payload, signed by the operator key (rotates to a multisig at v0.3).

**Memo payload format:**
```
noren-banlist-v<N>:<sha256-of-list-hex>:<unix-ms-timestamp>
```

Example:
```
noren-banlist-v3:a8f2c91d4b3e8f7a92c1d0e5b6c8d9a2b3c4e7f1a8d9b2c5e6f7a8b9c0d1e2f3:1717428293000
```

**Properties:**
- Single transaction, no contract deployment
- Cost is one ordinary transfer's gas per version update
- The sender address is verifiable; the signature is verifiable; the payload is deterministic

**Verification (ConstitutionVerifier):**
1. Query a Robinhood Chain RPC for transactions sent by the operator address whose calldata is a memo.
2. Filter to txs whose memo matches `^noren-banlist-v(\d+):([0-9a-f]{64}):(\d+)$`.
3. Pick the tx with highest block-height (latest version).
4. Extract `<sha256-of-list-hex>`.
5. Read `landing/public/constitution/ban-list.json` from the repo.
6. Hash it; assert match.
7. If mismatch: ConstitutionVerifier emits a `kind=constitution_drift` event with the on-chain expected hash vs the file's actual hash. The mechanical lens rejects the commit; verifier-refuter signs the rejection.

**Rotation:**
- Operator publishes a new ban-list update by editing `landing/public/constitution/ban-list.json`, computing its sha256, and posting a new memo tx from the operator key
- The new memo's higher block-height supersedes the prior version
- Old memo entries remain on-chain forever as historical audit trail

**Failure modes + mitigations:**
- Operator hot wallet compromised → attacker posts new memo with attacker's preferred ban-list. **Mitigation v0.3:** multisig authority (2-of-3 minimum)
- RPC outage → ConstitutionVerifier can't read latest memo. **Mitigation:** fall back to the highest version it last successfully verified, with a yellow stale-anchor badge on `/verify`; reject only if stale >24 hours
- Operator forgets to publish a new memo when ban-list file changes → silent drift between file and on-chain anchor. **Mitigation:** pre-commit hook in noren repo that hashes the file and refuses to commit unless a matching memo is posted within last 24 hours (or `--unsafe-banlist-drift` env var explicitly set, for operator dev workflows)

## v0.3 — Multisig authority

- Authority moves from the single operator key to a multisig (2-of-3 minimum)
- Further governance of ban-list updates is not specified and not built

## Acceptance criteria for v0.2 ship (Week 2 ConstitutionVerifier ship target)

- [ ] `docs/provenance/constitution-anchoring.md` (this file) reviewed by the operator
- [ ] Calldata-memo path confirmed
- [ ] `landing/public/constitution/ban-list.json` v1 written
- [ ] Initial memo tx posted from the operator key on Robinhood Chain with v1 sha256
- [ ] ConstitutionVerifier reads memo + asserts file hash matches
- [ ] False-positive rollback path documented per investor stress-test (operator-override emits audit row + on-chain memo tagged `noren-override-v<N>:<reason-hash>:<ts>`)

## What this does NOT anchor

This anchor covers ONLY the ban-list. The other constitution surfaces (autonomous-author check, scaffold_mutation_scope predicate, etc.) are baked into the verifier's compiled binary at build time. Their integrity depends on the binary's integrity, which is anchored by the gitsign/cosign chain (Anchor 1) on the verifier binary itself.

Defense-in-depth: ConstitutionVerifier is rebuilt from source each verifier-replay; the source is signed; the source defines what counts as in-bounds. Changing the verifier requires a commit, which goes through the verifier circle, which uses the current verifier. Self-bootstrapping cycle broken only at the v0.2 launch commit (the operator's hardware-wallet-signed first commit that ships the verifier binary itself).
