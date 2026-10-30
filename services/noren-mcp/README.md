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
| `noren_verify_payment` | Reads a transaction from the chain RPC and returns its USDG transfers. Does not trust the gateway |
| `noren_pay_call` | Calls one paid API and pays for it over x402 |

## Add it to a client

```bash
claude mcp add noren --transport stdio -- npx -y noren-mcp
```

or in any MCP client config:

```json
{ "mcpServers": { "noren": { "command": "npx", "args": ["-y", "noren-mcp"] } } }
```

The five read tools need no configuration.

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
