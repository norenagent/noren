# noren-pay

A Claude Code and Codex plugin: a skill that teaches the safe way to pay for APIs over x402, plus the Noren MCP server.

## What you get

- **Skill `noren-pay`**: when to use each tool and the two-step, no-key payment flow.
- **MCP server `noren`** (hosted at `https://mcp.usenoren.xyz/mcp`): list APIs, stats, wallet reputation, on-chain verification, and `noren_payment_request` / `noren_submit_payment`.
- **Command `/noren`**: quick look at APIs, stats or a wallet's reputation. It never pays.

## Install

```bash
claude plugin marketplace add norenagent/noren
claude plugin install noren-pay@noren
```

Or only the MCP server:

```bash
claude mcp add --transport http noren https://mcp.usenoren.xyz/mcp
```

For an agent that pays by itself with your own key and spending caps, use the local server instead (`npx -y noren-mcp`, see the skill).

Payments are in USDG on Robinhood Chain. Docs: https://docs.usenoren.xyz/mcp-server
