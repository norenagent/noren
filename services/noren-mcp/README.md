# noren-mcp

MCP server for [Noren](https://usenoren.xyz): read the x402 gateway, check a wallet's reputation, verify a payment straight from the chain, and pay for a gateway API in USDG on Robinhood Chain.

Every tool wraps something that is live today. There is no GPU, staking or escrow tool, because none of that exists yet.

## Tools

| Tool | What it does |
|---|---|
| `noren_gateway_stats` | Paid APIs, 402 challenges and settled payments on Robinhood Chain (`eip155:4663`) |
| `noren_list_apis` | The pay-per-call APIs with slug, path and price in USDG |
| `noren_reputation` | Score and tier for a wallet, computed only from payments that settled, with the transaction hashes |
| `noren_leaderboard` | Top paying wallets |
| `noren_check_counterparty` | Guard: check a wallet before paying it. Gateway reputation plus on-chain ETH balance and transaction count, returned as a verdict (`known_good`, `limited_history`, `unknown`) with the reasons and a caveat |
| `noren_verify_payment` | Reads a transaction from the chain RPC and returns its USDG transfers. Does not trust the gateway |
| `noren_payment_request` | Step 1 of paying without sharing a key: price, approve transaction if needed, and the EIP-712 data your wallet signs. Nothing is spent |
| `noren_submit_payment` | Step 2: send the intent and your signature. The gateway settles USDG and returns the result and the transaction |
| `noren_pay_call` | Local only: calls one paid API and pays with a key and caps you set |

## Guard: check before you pay

`noren_check_counterparty` takes an address and returns `{ address, verdict, score, tier, settledCount, totalUsdg, firstSeen, lastSeen, txCount, ethBalance, reasons, caveat }`. Rules are fixed:

- `known_good`: at least 5 settled payments and score of 40 or more
- `limited_history`: 1 to 4 settled payments (or 5 or more with a score under 40)
- `unknown`: no settled payments recorded

It reads the gateway reputation and, from the Robinhood Chain RPC, the native ETH balance and transaction count. If the RPC is unreachable you still get the reputation, with the gap stated in `caveat`. The verdict reflects only payments settled through the Noren gateway. It is not a guarantee about a wallet.

## Resources

| URI | Content |
|---|---|
| `noren://apis` | The paid API catalog (JSON) |
| `noren://stats` | Live gateway statistics (JSON) |
| `noren://wallet/{address}` | Reputation of a wallet (JSON template) |

## Prompts

| Prompt | Arguments | What it does |
|---|---|---|
| `buy_api` | `slug`, `payer` | Walks the model through the safe flow: list, price and your yes, payment request, approve, sign, submit, verify |
| `check_before_paying` | `address` | Runs `noren_check_counterparty` and summarizes it in three lines |

Prompts never contain key material.

## Add it to a client

```bash
claude mcp add noren --transport stdio -- npx -y noren-mcp
```

or in any MCP client config:

```json
{ "mcpServers": { "noren": { "command": "npx", "args": ["-y", "noren-mcp"] } } }
```

The six read tools and the two payment tools need no configuration. Every tool carries a title and MCP annotations (read tools are marked read-only; `noren_payment_request` spends nothing). They are also served at `https://mcp.usenoren.xyz/mcp`.

## Paying without giving up a key (hosted or local)

1. `noren_payment_request` with `slug` and your `payer` address.
2. If `needsApprove` is true, send the returned approve transaction from your wallet (exact price only, a little ETH for gas).
3. Sign `typedData` with `eth_signTypedData_v4`.
4. `noren_submit_payment` with `slug`, the `intent` unchanged and the `signature`.

The server re-reads the challenge on submit and refuses a changed payee, amount or resource, or a request older than five minutes.

## Paying (opt in)

`noren_pay_call` stays off until you set a key and two caps in the client environment:

| Variable | Meaning |
|---|---|
| `NOREN_PAYER_KEY` | Private key of the wallet that pays. It is read in-process, signs one EIP-712 intent, and is never returned to the model. Error text is scrubbed of it |
| `NOREN_MAX_USDG_PER_CALL` | Refuse any API priced above this (for example `0.05`) |
| `NOREN_MAX_USDG_PER_DAY` | Refuse once the day's total would pass this (for example `0.2`) |
| `NOREN_GATEWAY_URL` | Optional, defaults to `https://gateway.usenoren.xyz` |

How a payment goes:

1. The tool reads the price from the gateway list. The model cannot pass or change a price.
2. It checks both caps. Missing or zero caps mean no payments.
3. It requests the API, receives a `402`, and checks the network is `eip155:4663`, the asset is USDG and the amount does not exceed the listed price.
4. It approves the gateway spender for exactly that amount, signs the intent with your key and settles through the facilitator.
5. It redeems the receipt and returns the API result and the settlement transaction.

Use a dedicated wallet with a small balance. The wallet also needs a little ETH for the approve transaction.

## Develop

```bash
pnpm install --ignore-workspace
pnpm typecheck && pnpm test && pnpm build
npx tsx scripts/probe.mts          # protocol probe over stdio, read tools
npx tsx scripts/probe.mts pay      # spends 0.01 USDG from the test wallet
```

## Limits

- One payment per call, up to the price listed by the gateway.
- Verification covers USDG `Transfer` events on Robinhood Chain.
- The daily total is kept in memory for the life of the process.

Apache-2.0.
