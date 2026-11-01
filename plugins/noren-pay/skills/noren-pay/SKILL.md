---
name: noren-pay
description: Use when an agent needs to buy a paid API, check a wallet's payment reputation, or verify a USDG payment on Robinhood Chain over x402. Covers the Noren MCP tools and the safe two-step payment flow.
---

# Noren: pay for APIs over x402

Noren sells small pay-per-call APIs. Payment is in USDG on Robinhood Chain (`eip155:4663`). There are no accounts or API keys: the payment is the authentication.

## Tools (MCP server `noren`)

| Tool | Use it to |
|---|---|
| `noren_list_apis` | See what is for sale: slug, path, price in USDG. Free. |
| `noren_gateway_stats` | Live counts: APIs, 402 challenges, settled payments. |
| `noren_reputation` | Score and tier of a wallet, from payments that settled. |
| `noren_leaderboard` | Top paying wallets. |
| `noren_check_counterparty` | Guard: verdict (`known_good`, `limited_history`, `unknown`) for a wallet from gateway reputation plus on-chain ETH balance and transaction count, with a caveat. |
| `noren_verify_payment` | Check a transaction straight from the chain RPC. Does not trust the gateway. |
| `noren_payment_request` | Step 1 of paying: price, approve transaction, EIP-712 data to sign. Spends nothing. |
| `noren_submit_payment` | Step 2: send the signed intent. Settles USDG, returns the API result and the transaction. |
| `noren_pay_call` | Local stdio server only: pays with a key and caps from the environment. |

MCP prompts: `buy_api` (args `slug`, `payer`) runs the safe payment flow below; `check_before_paying` (arg `address`) runs the Guard check and summarizes it in three lines. Resources: `noren://apis`, `noren://stats`, `noren://wallet/{address}`.

## Paying without giving anyone a key

1. `noren_list_apis`, pick a slug, note the price.
2. `noren_payment_request` with `slug` and the payer's wallet address.
3. If `needsApprove` is true, the wallet must send the returned `approve` transaction first. It allows the gateway to move exactly the price, nothing more, and needs a little ETH for gas on Robinhood Chain. Wait for it to confirm.
4. The wallet signs `typedData` with `eth_signTypedData_v4`. Never ask the user for a private key, and never put one in a tool call.
5. `noren_submit_payment` with `slug`, the `intent` exactly as returned, and the `signature`.
6. Report the API result and the settlement transaction. Offer `noren_verify_payment` on that hash.

The request is valid for five minutes. If it expires, start again from step 2.

## Rules

- Before paying an unfamiliar wallet or API seller, call `noren_check_counterparty` and tell the user the verdict and its caveat.
- Tell the user the price before step 2 and get a yes. Do not pay in a loop.
- Only Robinhood Chain and USDG are supported. If a challenge says otherwise, stop.
- Never alter the intent. The server compares payee, amount and resource against a fresh challenge and refuses a change.
- If settlement fails, show the reason from the tool. Common ones: no allowance, no USDG, expired request, wallet out of gas.
- Reputation is read-only and public. It is not a reason to skip the price check.

## Paying by itself (local, opt in)

Run the stdio server with a dedicated wallet that holds only what you are willing to spend:

```json
{ "mcpServers": { "noren": { "command": "npx", "args": ["-y", "noren-mcp"],
  "env": { "NOREN_PAYER_KEY": "0x...", "NOREN_MAX_USDG_PER_CALL": "0.05", "NOREN_MAX_USDG_PER_DAY": "0.2" } } } }
```

Then `noren_pay_call` with a slug does the whole flow. Caps are required; without them it refuses.

Docs: https://docs.usenoren.xyz/mcp-server
