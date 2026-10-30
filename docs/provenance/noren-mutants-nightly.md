# noren-mutants-nightly — Nightly Mutation-Testing Job

Status: Spike 13 design, ready to implement once Week 1 ship lands.

## Why nightly, not per-rev

Spike 10 measured `cargo mutants --in-diff` at 5-30 min per scaffold rev. That blows the verifier-replay budget (target <30 min total per rev) and would collapse scaffold-admission rate to <1/week, which empties `/lineage` at launch.

Plan-level decision (Spike 10 verdict): per-rev gate uses cheap proxies (`test_count_delta + clippy_warning_delta + nextest_pass_rate`); cargo-mutants moves to a separate nightly job. Per-rev cost stays <10 min warm; mutation quality still feeds scoring at sprint roll-up but with a one-day lag instead of per-commit.

## Job spec

**Cadence:** 03:00 local (operator's quiet window). Separate launchd job `com.noren.mutants-nightly` (DOES NOT extend or replace `org.noren.loop` — the supervisor + this job are independent).

**Scope:** mutations against the day's accepted scaffold revisions only:
```
cargo mutants --in-diff $(git merge-base origin/main HEAD)..HEAD \
  --workspace --no-default-features --features mutants-quick \
  --timeout 60 --jobs 4 --output-dir /tmp/noren-mutants-$(date +%Y-%m-%d)
```

Plus a weekly **Sunday full-workspace** run (no `--in-diff`) to surface drift in untouched code:
```
cargo mutants --workspace --no-default-features --features mutants-quick \
  --timeout 60 --jobs 4
```

**Output landing path:** `landing/public/mutants/<YYYY-MM-DD>.json`

Schema:
```json
{
  "date": "2026-06-04",
  "scope": "in_diff" | "weekly_full",
  "commits_covered": ["sha1", "sha2", ...],
  "total_mutations": 142,
  "caught": 128,
  "missed": 14,
  "timeout": 0,
  "score": 0.901,
  "missed_details": [
    {
      "file": "agent-os/crates/noren-permissions/src/lib.rs",
      "line": 245,
      "mutation": "replace + with - in compute_quota_remaining",
      "function": "compute_quota_remaining",
      "tests_run": ["scope_namespace_from_action_pins_each_prefix_and_unknown_fallthrough"],
      "verdict": "missed — no test exercises the addition path"
    }
  ],
  "regressions": [
    {
      "file": "...",
      "line": 100,
      "previously_caught": "2026-06-02",
      "now_missed": true,
      "introduced_by_commit": "abc123"
    }
  ]
}
```

## Feeds — what consumes the nightly output

1. **Pareto scaffold-archive ranking (Week 3 ship).** Mutation-catch score is one dimension in the Pareto scoring vector alongside `test_count`, `clippy_warnings`, `lines_changed`, `verifier_circle_agreement_rate`. Higher mutation score = better Pareto rank = more likely admission.

2. **`/lineage/mutation-quality` page (v0.2.1 stretch).** Public-facing chart of mutation-catch rate trend over time. Visitor can see "system's test quality improving" or detect when a scaffold rev causes a drop. Live link from Lineage Recursion demo.

3. **`agent-os/autonomy/events.jsonl` regression rows.** When a mutation that was previously caught becomes missed (regression), emit:
   ```json
   {"timestamp":"...","kind":"mutation_regression","file":"...","line":...,"introduced_by_commit":"...","note":"Test no longer catches mutation; was caught on 2026-06-02"}
   ```
   The loop sees these next sprint and can spawn a `fix-mutation-regression-<file>-<line>` task automatically.

4. **`landing/app/lineage/mutation-quality/page.tsx` trend surface.** Renders the mutation-catch trend independently of any on-chain witness claim. The retired per-commit witness UI must not be cited as a verification surface until Noren ships a real verifier.

## Acceptance criteria

- [ ] launchd plist at `~/Library/LaunchAgents/com.noren.mutants-nightly.plist`
- [ ] `cargo install cargo-mutants` reproducible on operator's host (pin version in `infra/mutants-version.txt`)
- [ ] First nightly run produces a valid JSON output at `landing/public/mutants/<date>.json`
- [ ] Decide whether mutation regressions should be surfaced through a future Noren verification product. The retired public witness stream must not be restored without a verified backing service.
- [ ] `/lineage/mutation-quality` page (v0.2.1) reads the JSON, renders the trend

## What this does NOT do

- Does NOT gate scaffold-rev admission per-rev (that's the cheap-proxy job in the verifier-replay)
- Does NOT block sprint cycles (runs in its own launchd slot)
- Does NOT mutation-test the v0.2 launch baseline (first run mutates only post-launch deltas; full-workspace catches the baseline over the first Sunday)
- Does NOT replace cargo-fuzz or property-based testing (those are separate quality vectors, future v0.3 cards)

## Cost

Roughly 30-90 min CPU per night (depending on day's accepted-scaffold diff size). Weekly Sunday full-workspace: 4-8 hours, runs overnight, no impact on day operations.

Storage: one JSON per day, ~10-50KB each, landing in `landing/public/mutants/`. After 90 days, archive to `landing/public/mutants/archive/<YYYY-MM>/` and rotate.
