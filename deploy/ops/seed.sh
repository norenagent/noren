#!/usr/bin/env bash
## Idempotent sandbox seeding. Runs AFTER norend is healthy.
## Everything goes through the real daemon (HTTP gateway / CLI); nothing is
## written into the state dirs directly. Safe to re-run: capabilities are
## granted only if missing and the sample intents run only if no "sample:"
## task exists yet in memory.
##
## Env: NOREN_HOME (default /var/lib/oc-sandbox), NOREN_HTTP_PORT (8421)

set -uo pipefail
export NOREN_HOME="${NOREN_HOME:-/var/lib/oc-sandbox}"
PORT="${NOREN_HTTP_PORT:-8421}"
BASE="http://127.0.0.1:$PORT"
log() { echo "seed: $*"; }

# serialise concurrent runs (entrypoint hook + reset unit)
exec 9>/tmp/oc-sandbox-seed.lock
flock 9

# 1. wait for the daemon (up to ~60s)
ok=0
for _ in $(seq 1 120); do
  if curl -fs "$BASE/health" >/dev/null 2>&1 && noren ping >/dev/null 2>&1; then ok=1; break; fi
  sleep 0.5
done
[[ $ok == 1 ]] || { log "daemon not healthy, giving up"; exit 1; }

# 2. minimal capabilities for the key-free sandbox agent (nothing dangerous:
#    no network/secret/x402/audit.purge/tool.*).
existing="$(noren capabilities recent -n 200 2>/dev/null || true)"
for action in intent.subscribe memory.write memory.read; do
  if grep -q "$action" <<<"$existing"; then
    log "capability $action already granted"
  elif noren capabilities grant "$action" >/dev/null 2>&1; then
    log "granted $action"
  else
    log "grant $action failed"
  fi
done

# 2b. workspace + agent capabilities. A reset wipes every grant, so these must be
#     re-issued each time or the public workspace and agent fail with
#     "requires capability". They go through the real daemon with the operator
#     bearer (never exposed to the browser). The public proxy still refuses to
#     let anonymous callers grant any of them.
if [[ -r $NOREN_SANDBOX_ENV ]]; then
  OPTOK="$(grep -E '^NOREN_OPERATOR_TOKEN=' $NOREN_SANDBOX_ENV | head -1 | cut -d= -f2-)"
else
  OPTOK=""
fi
if [[ -n "$OPTOK" ]]; then
  grant_scoped() {  # <action> <json-scope-or-empty> <label>
    local body
    if [[ -n "$2" ]]; then body="{\"action\":\"$1\",\"scope\":$2}"; else body="{\"action\":\"$1\"}"; fi
    if curl -fs -m 15 -H "Authorization: Bearer $OPTOK" -H 'content-type: application/json' \
         -d "$body" "$BASE/capabilities/grant" >/dev/null 2>&1; then
      log "granted $3"
    else
      log "grant $3 FAILED"
    fi
  }
  if [[ "$(grep -c 'workspace.run' <<<"$existing")" -lt 2 ]]; then
    grant_scoped workspace.run '{"workspace":"web-starter"}' "workspace.run[web-starter]"
    grant_scoped workspace.run '{"workspace":"python-run"}' "workspace.run[python-run]"
  else
    log "workspace.run already granted"
  fi
  if grep -q 'agent.code' <<<"$existing"; then
    log "agent.code already granted"
  else
    grant_scoped agent.code '' "agent.code"
  fi
else
  log "no operator token readable; workspace and agent capabilities NOT granted"
fi

# 3. sample runs (skip if already seeded; the agent tags sample outputs "[sample run]")
if noren memory recent -n 200 2>/dev/null | grep -q "sample run"; then
  log "sample intents already present; skipping"
  exit 0
fi

# NB: the v0 router matches by keyword overlap, so each sample carries a
# routable word ("this"/"please"/"remember"). See deploy/SANDBOX.md.
INTENTS=(
  "sample: please hash this text: Noren sandbox"
  "sample: please count this: the quick brown fox jumps over the lazy dog the end"
  "sample: please plan this: launch a small blog, write three posts, then share them"
  "sample: please calc this: 2*(3+4)**2 / sqrt(16)"
  "sample: please extract this todo: email Sam; book flights; review the open PR"
  "sample: please check this json: {\"agent\":\"sandbox\",\"ok\":true,\"n\":[1,2,3]}"
  "sample: remember the sandbox resets every 12 hours"
  "sample: remember Noren agents declare their capabilities in agent.toml"
  "sample: remember this deployment runs a key-free rule-based agent, not an LLM"
)
n=0
for t in "${INTENTS[@]}"; do
  if noren intent "$t" >/dev/null 2>&1; then n=$((n+1)); else log "intent failed: ${t:0:40}"; fi
done
log "submitted $n/${#INTENTS[@]} sample intents"
