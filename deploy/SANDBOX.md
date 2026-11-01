
## Monitoring (2026-11-01)

`deploy/noren-monitor.js` runs every minute from `noren-monitor.timer` and keeps state in `/var/lib/noren-monitor/`.
It reads only public endpoints, local service state and the error file below. It spends nothing and sends nothing but alerts.

| Check | Fails when |
|---|---|
| `svc:*` (5 services) | a unit is not active |
| `public:*` (web, docs, sandbox, gateway, mcp) | a page does not answer 200 from the outside |
| `sandbox:audit-chain` | the public audit verify reports `valid: false` |
| `gateway:settlement-gas` | the settlement wallet holds less than 0.0001 ETH |
| `gateway:facilitator` | `/supported` advertises no payment kinds |
| `mcp:tools` | the hosted MCP lists fewer than 8 tools |
| `host:disk` | the root disk is 92% full or more |
| `sandbox:errors` | the console recorded more than 5 server errors in 10 minutes |

Alerts fire on a change (ok to bad, bad to ok) and repeat every 6 hours while something stays bad. They go to
`alerts.log` and to Telegram when `/etc/noren-monitor/alerts.env` holds a bot token and chat id (mode 0600, not in the repo).

The console records server errors itself: `agent-os/noren-web/instrumentation.ts` implements Next.js `onRequestError` and appends
one JSON line per error to `$NOREN_ERROR_DIR/sandbox-web-errors.jsonl`. A line holds the route pattern, the error name and a
trimmed message. It never holds a query string, header, cookie, request body or full hash. `scripts/hook-proof.mts` checks that.
