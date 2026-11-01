# Noren: Software Design Document (status snapshot)

Date: 2026-10-29 · Scope: usenoren.xyz web, docs, sandbox, x402 gateway, agent workspace, on-chain prep
Legend: 🟢 done and verified · 🟡 works but partial, unproven, or has a known limit · 🔴 not built

---

## 1. Purpose

Noren is an operating layer for autonomous agents. A visitor or an agent gets capability-scoped, audited actions, a paid x402 API gateway on Robinhood Chain (4663), and an isolated workspace where code is written, run and tested.

Non-goals today: a Noren token, staking, treasury and settlement contracts. They are not built and not claimed.

## 2. Architecture

```
Browser
  → Cloudflare (usenoren.xyz zone, tunnels)
      ├─ usenoren.xyz / docs.            → oc-landing (Next, :4310)
      ├─ sandbox.                        → oc-sandbox-web (Next proxy, :4311)
      │     rate limit · Turnstile · daily quota · privileged-grant block
      │        → norend daemon (:8421, bearer)
      │             capability check → audit chain
      │             → DockerWorkspaceRunner (gVisor runsc)
      │             → CodeAgent → LLM provider (DeepSeek, call-capped)
      └─ gateway.                        → noren-proxy (:8792) via dedicated tunnel
```

Trust boundaries: the browser is untrusted. The Next proxy is the only public ingress. The daemon never takes an image, command, runtime or limit from a request. The model is untrusted, and the sandbox, not the model, is the security boundary.

## 3. Component status

### 3.1 Public surface
| Component | Status | Evidence / limit |
|---|---|---|
| Domain `usenoren.xyz` (web, www, docs, sandbox, gateway) | 🟢 | all return 200; zone active on a free plan |
| Landing and docs rebrand to Noren | 🟢 | tests 58/58, build and typecheck pass |
| Docs for x402 (gateway live, facilitator live) | 🟢 | "coming soon" kept only for trust-read and compute |
| CSS first-paint flash | 🟢 | CSS inlined; first frame now styled |
| GitHub org / repo for Noren | 🔴 | undecided. `origin` still points at the old org; 20 local commits are unpushed |

### 3.2 x402 gateway
| Component | Status | Evidence / limit |
|---|---|---|
| 402 challenge, facilitator, discovery files | 🟢 | `/x402/premium` → 402; `/facilitator/supported` lists schemes |
| Real on-chain payment | 🟢 | 0.01 USDG settled, tx `0x8fd539f9…dd13f2` block 100630582; replay rejected |
| Dedicated tunnel (no leak to other products) | 🟢 | `noren-gateway-tunnel`; 5/5 JSON, no fallback page |
| Paid API catalogue (5 routes) | 🟡 | 3 core routes renamed to Noren; others are legacy listings |
| EIP-712 domain name `NOREN` | 🟡 | kept on purpose, it is part of signatures. Rename would break payments |
| Gateway code under version control | 🔴 | `the gateway directory` is not a git repo; only file backups exist |

### 3.3 Daemon, capabilities, audit
| Component | Status | Evidence / limit |
|---|---|---|
| Capability enforcement (`tool.call.*`, `workspace.run`, `agent.code`) | 🟢 | denied without capability; tested through the daemon |
| Append-only audit chain | 🟢 | 956 events, `valid: true`, no failures |
| Audit stores hashes only for workspace and agent runs | 🟢 | task text and generated code never stored |
| Public tool registry | 🟡 | only `clock` and `echo` |
| Agent passport / verification APIs | 🔴 | were `501 not_available_yet`; the paths I re-probed today returned 404/200, so treat as not built |
| Paid trust-read and compute routes | 🔴 | not implemented |

### 3.4 Agent workspace
| Component | Status | Evidence / limit |
|---|---|---|
| Docker + gVisor runner (`runsc`) | 🟢 | kernel inside is `4.19.0-gvisor`; host is 5.15 |
| Per-run isolation: no network, no host mounts, read-only root, caps dropped, non-root uid 10001 | 🟢 | adversarial battery passed through the real daemon |
| Limits: 1 CPU, 128 MB, 32 PIDs, 8 MB disk (tmpfs), 10 s, bounded output | 🟢 | fork/memory/disk/loop/inode attacks contained |
| Preset `web-starter` (fixed, no input) | 🟢 | public run 200 |
| Preset `python-run` (user source ≤16 KB) | 🟢 | gVisor required; Turnstile + 30/day/IP; real browser run confirmed by user |
| Startup sweeper for leftover mounts and containers | 🟢 | planted stale mount, symlink, foreign dir: cleaned or left alone correctly |
| Concurrency cap (2 containers) | 🟡 | 12 parallel requests: 2 ran, 10 got "busy". No queue, so request 3 must retry |
| Image provisioning | 🟡 | images exist only on this host; no build pipeline recorded |
| Presets beyond the two above (Node, Rust, etc.) | 🔴 | not built |
| Network egress for workspaces | 🔴 | intentionally off; no allowlist proxy exists |

### 3.5 Code agent
| Component | Status | Evidence / limit |
|---|---|---|
| Write, run, repair loop (max 4 rounds) | 🟢 | 13 unit tests; live test repaired a broken program in real gVisor |
| Real model (DeepSeek `deepseek-chat`) | 🟢 | 8 task types passed in 1 to 2 rounds, 6 to 23 s |
| Website building (`.html .css .js`) | 🟢 | Ember landing page produced and rendered; desktop and mobile checked |
| Preview isolation (`sandbox` iframe + CSP `default-src 'none'`) | 🟢 | hostile page: no parent/cookie/storage access, 0 of 12 request vectors reached a listener |
| Gates: capability, Turnstile, 2/min, 5 tasks/day/IP, 600-char task | 🟢 | public no-token and fake-token both 403; anonymous grant of `agent.code` blocked |
| Turnstile retry and manual retry button | 🟡 | proven with a fake Cloudflare; the real widget's `600010` failure on the user's network not reproduced |
| Daily spend cap | 🟡 | caps calls (60/day), not dollars; real cost depends on the model |
| Output correctness | 🟡 | tests passing does not mean the docs are true (a docstring contradicted its code) |
| Design quality of generated sites | 🟡 | acceptable, not premium; no external images because CSP blocks them |
| Website agent run in the user's own browser | 🟡 | python agent confirmed by the user; website task not yet confirmed |

### 3.6 On-chain (Robinhood 4663)
| Component | Status | Evidence / limit |
|---|---|---|
| Foundry build and tests | 🟢 | 6 suites, 89 tests pass |
| `SpendGrantEscrow` fork rehearsal against live 4663 and real USDG | 🟢 | deploy script runs, ships paused; about 8.5M gas, about 0.0002 ETH |
| `SpendGrantEscrow` deployed | 🔴 | needs six roles chosen by the operator and a funded deployer |
| Existing 4663 contracts (bond verifier, reputation, trade guard, executor) | 🟡 | have bytecode, but owner and attestor belong to the earlier Noren deployment, not Noren |
| Noren token, staking, treasury, settlement | 🔴 | not in the repo; supply, fee and distribution are product/legal decisions |

## 4. Security design

1. No caller-controlled image, command, runtime, mount, environment or limit.
2. Defense in depth: proxy gates, then daemon capability, then gVisor, then resource limits, then tmpfs quota.
3. Fail closed: code-taking presets refuse to run when the runtime is unset; an unknown runtime errors instead of falling back to runc.
4. Secrets: model key and Turnstile secret live in `$NOREN_SANDBOX_ENV` (mode 600), never logged or returned.
5. Findings fixed during build: anonymous callers could grant `agent.code` via a namespace gap (closed with an exact-action list); non-root container could not write a root-owned workspace; agent site built inside Python so nothing was previewable; model output truncated at 4096 tokens.

Known residual risks:
- 🟡 The DeepSeek key was pasted in chat and must be rotated.
- 🟡 gVisor on a shared VPS is strong isolation, not a hardware boundary.
- 🟡 Model output is untrusted; the iframe CSP is the only barrier in the visitor's browser.

## 5. Verification evidence (last full runs)

| Suite | Result |
|---|---|
| norend lib | 908 pass (13 agent tests since added) |
| noren-ipc | 158 pass |
| noren-audit | 86 pass |
| noren-runtime | 106 pass, plus live gVisor and Docker tests |
| noren-llm | 60 pass |
| Foundry | 89 pass, 2 fork tests |
| Landing | 58 pass, typecheck and build clean |
| Console | typecheck and lint clean |
| Live checks | web/docs/sandbox/gateway 200; `/x402/premium` 402; no leftover containers, mounts or folders |

## 6. Operations

| Item | Status |
|---|---|
| Services: `oc-landing`, `oc-sandbox-web`, `oc-sandbox-daemon`, `noren-proxy`, two tunnels | 🟢 active, none failed |
| Binary rollback copies in `$HOME/norend.bak-*` | 🟢 |
| Disk | 🟡 91% used (11 GB free) after cleanup; pnpm cache 7.7 GB and `target/` 5.5 GB are reclaimable |
| Backup of `/var/lib/oc-sandbox` (audit chain, capabilities, identity) | 🔴 not set up |
| Uptime monitoring and alerts | 🔴 not set up |
| CI for the web console | 🔴 none; checks are run by hand |

## 7. Decisions needed from the operator

1. Rotate the DeepSeek key and send the new one.
2. Choose GitHub org and repo name for Noren, and whether to rebrand sibling repos now.
3. For the escrow: admin (Safe), attestor, treasury, emergency admin, gateway, plus a funded deployer.
4. Whether to commit to a token and staking design. Nothing is built until this is decided.
5. How much more disk to free (Tier 2 folders are not git and cannot be recovered).

## 8. Suggested order of work

1. 🟡→🟢 Confirm the website agent and Turnstile in the operator's real browser.
2. 🔴→🟢 Backup and monitoring for the daemon state.
3. 🟡→🟢 Short queue for workspace requests.
4. 🔴→🟢 Put the gateway code under git.
5. 🔴→🟢 Real passport/verify endpoints from the audit chain.
6. 🔴 Deploy the escrow once the roles are chosen.
7. 🔴 Token, staking, treasury after the product decision.
