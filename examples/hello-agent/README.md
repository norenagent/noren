# hello-agent

A minimal Noren agent. It accepts an intent, echoes the request text, and exits. The point is not the agent — it is the surrounding daemon protocol: manifest validation, capability check, runtime dispatch, and audit attribution.

## What this example demonstrates

Four primitives, one round trip:

| Primitive   | Role in this example |
|-------------|----------------------|
| Intent      | `noren intent "say hello"` is normalized into a typed request and routed to this agent. |
| Permissions | The manifest's `[capabilities].required = ["intent.subscribe"]` is checked against the daemon's identity registry at dispatch. |
| Runtime     | `norend` spawns `python3 main.py` as a bounded subprocess under the `trusted-local` backend (the default; see `docs/runtime-sandbox-security.md` for the sandbox-required path). |
| Audit       | One `IntentDispatched` row lands in `$NOREN_HOME/audit/events.jsonl`, hash-chained into `events.chain.jsonl`. |

Memory, settlement, and the other primitives are not exercised by this example. See [`docs/demo.md`](../../docs/demo.md) for a fuller walkthrough.

## Run it

Assuming the daemon and CLI are already built:

```bash
# Register this agent (daemon loads $NOREN_HOME/agents/ at startup)
mkdir -p ~/.noren/agents
cp -R ./examples/hello-agent ~/.noren/agents/hello

# In one terminal — start the daemon
./agent-os/target/debug/norend

# In another — dispatch an intent
./agent-os/target/debug/noren intent "say hello"
```

Expected `stdout`:

```
hello — you asked: 'say hello'
```

## Verify the audit row

```bash
./agent-os/target/debug/noren audit recent --kind IntentDispatched --json | tail -1
```

You should see one event whose payload names `agent_id = "hello"`. Verify the local hash chain over the retained log:

```bash
./agent-os/target/debug/noren audit verify --json
```

Both commands are also exposed over the local HTTP gateway under capability-checked paths.

## Where to look next

- `agent.toml` — manifest schema (see [agent-os/crates/noren-manifest](../../agent-os/crates/noren-manifest/) for the parser).
- `main.py` — the wire protocol is one JSON line in, one JSON line out.
- [docs/capabilities.md](../../docs/capabilities.md) — capability scope envelope contract for each namespace.
- [docs/audit-integrity.md](../../docs/audit-integrity.md) — chain construction and verification.
