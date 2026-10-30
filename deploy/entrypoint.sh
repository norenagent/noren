#!/usr/bin/env bash
## Demo-mode entrypoint for norend on Render.
##
## - Honors NOREN_OPERATOR_TOKEN env (b58 string) by writing it to the
##   on-disk operator.token before the daemon starts, so both services share
##   the same bearer credential.
## - Copies the bundled demo-agent (Haiku-backed) into $NOREN_HOME/agents.
## - Waits for the daemon HTTP gateway to come up, then grants baseline
##   capabilities so a fresh container is immediately useful.

set -euo pipefail

NOREN_HOME="${NOREN_HOME:-/data}"
HTTP_PORT="${NOREN_HTTP_PORT:-8421}"
HTTP_HOST="${NOREN_HTTP_BIND_ADDR:-0.0.0.0}"

mkdir -p "$NOREN_HOME/peers" "$NOREN_HOME/agents" "$NOREN_HOME/audit" \
         "$NOREN_HOME/memory" "$NOREN_HOME/capabilities" \
         "$NOREN_HOME/receipts" "$NOREN_HOME/a2a" "$NOREN_HOME/budget" \
         "$NOREN_HOME/identity"

if [[ -n "${NOREN_OPERATOR_TOKEN:-}" ]]; then
  printf '%s' "$NOREN_OPERATOR_TOKEN" > "$NOREN_HOME/peers/operator.token"
  chmod 600 "$NOREN_HOME/peers/operator.token"
  echo "entrypoint: wrote operator token from env (mode 0600)"
fi

# Seed the demo-agent by default. Set NOREN_SEED_DEMO_AGENT=0 for a clean
# no-agent daemon (intents fall through to the phase-0 echo path instead of
# matching an agent) — used by execution-layer connectors that only need a
# trusted-local echo/audit backend, not the Haiku demo agent.
if [[ "${NOREN_SEED_DEMO_AGENT:-1}" == "1" ]]; then
  if [[ ! -d "$NOREN_HOME/agents/demo" ]]; then
    cp -R /opt/noren/demo-agent "$NOREN_HOME/agents/demo"
    echo "entrypoint: seeded demo-agent"
  fi
else
  echo "entrypoint: demo-agent seeding disabled (NOREN_SEED_DEMO_AGENT=${NOREN_SEED_DEMO_AGENT})"
fi

# Key-free sandbox agent (rule-based, no LLM). Installed when its package dir
# exists (default: the noren-rea deploy checkout). Always refreshed so
# edits to the package propagate; it carries no state.
SANDBOX_AGENT_SRC="${NOREN_SANDBOX_AGENT_SRC:-/opt/noren/deploy/sandbox-agent}"
if [[ -f "$SANDBOX_AGENT_SRC/agent.toml" ]]; then
  mkdir -p "$NOREN_HOME/agents/sandbox"
  cp "$SANDBOX_AGENT_SRC/agent.toml" "$SANDBOX_AGENT_SRC/main.py" "$NOREN_HOME/agents/sandbox/"
  echo "entrypoint: installed sandbox agent from $SANDBOX_AGENT_SRC"
fi

# The coder agent uses runtime=hermes and is only useful once a coding gateway
# is configured. Without HERMES_API_BASE_URL it would route coding intents to a
# HermesUnconfigured error, so seed it (and grant tool.code) only when the
# gateway URL is set — it stays dormant until the gateway is wired.
CODER_CAP=""
if [[ -n "${HERMES_API_BASE_URL:-}" ]]; then
  if [[ ! -d "$NOREN_HOME/agents/coder" ]]; then
    cp -R /opt/noren/coder-agent "$NOREN_HOME/agents/coder"
    echo "entrypoint: seeded coder-agent (HERMES_API_BASE_URL set)"
  fi
  CODER_CAP="tool.code"
fi

echo "entrypoint: starting norend on $HTTP_HOST:$HTTP_PORT"
norend &
DAEMON_PID=$!

# Wait for the HTTP gateway to accept requests.
for _ in $(seq 1 30); do
  if curl -fs "http://127.0.0.1:$HTTP_PORT/health" >/dev/null 2>&1; then
    echo "entrypoint: daemon ready"
    break
  fi
  sleep 0.5
done

# Idempotent capability seeding via the operator CLI (which reads the same
# operator.token we just wrote). Failures are non-fatal — the daemon stays up.
for action in memory.write intent.subscribe memory.read $CODER_CAP; do
  if noren capabilities grant "$action" >/dev/null 2>&1; then
    echo "entrypoint: granted $action"
  else
    echo "entrypoint: grant $action skipped (already granted, or daemon not ready yet)"
  fi
done

# Seed sample state through the daemon (idempotent) when a seed script exists.
SEED_SCRIPT="${NOREN_SEED_SCRIPT:-/opt/noren/deploy/seed.sh}"
if [[ -x "$SEED_SCRIPT" && -d "$NOREN_HOME/agents/sandbox" ]]; then
  "$SEED_SCRIPT" </dev/null &
fi

# Hand the foreground over to the daemon so Render can SIGTERM it cleanly.
wait "$DAEMON_PID"
