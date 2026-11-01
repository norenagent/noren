# noren-pay

Pay [x402](https://docs.usenoren.xyz/x402) APIs on Robinhood Chain with one call.

`fetchPaid('slug')` reads the 402 challenge, checks every field of it, enforces your spending caps, settles USDG through the Noren gateway and returns the data. No accounts, no API keys.

```sh
npm i noren-pay
```

```ts
import { createNorenPay } from 'noren-pay';

const pay = createNorenPay({
  privateKey: process.env.NOREN_PAYER_KEY!, // stays in your process
  maxPerCallUsdg: 0.05,
  maxPerDayUsdg: 0.5,
});

console.log(await pay.listApis());            // free catalog: slug, price, payTo
const { data, paidUsdg, settlementTx } = await pay.fetchPaid('news');
```

Requires Node 22+. The payer wallet needs USDG and a little ETH for gas on Robinhood Chain (`eip155:4663`).

## What it checks before any money moves

- The challenge is for `eip155:4663` and the asset is USDG.
- `payTo` and the spender are valid addresses.
- The price in the challenge is not higher than the price in the public catalog.
- The price is within `maxPerCallUsdg` and today's spend (UTC) stays within `maxPerDayUsdg`. Defaults: 0.10 and 1.00 USDG.
- The slug is lowercase letters, digits and dashes, so it cannot escape the path.
- The `approve` is for exactly the price, never unlimited.

A refused call throws `NorenPayError` with a `code` such as `cap_per_call`, `cap_per_day`, `overcharge`, `wrong_network`, `wrong_asset`, `unknown_api`.

## Limits

- Robinhood Chain and USDG only. Other chains are refused, not guessed.
- The daily cap is kept in memory. A restarted process starts at zero, so for hard limits also fund the payer wallet with only what you are willing to spend.
- If settlement succeeds but the final fetch fails, the spend is still counted and the error includes the settlement transaction.
- This is a client. It does not custody keys or run a server.

## Verified

Unit tests cover each refusal and assert the facilitator is never called when a check fails. One real call was made against the live gateway: `fetchPaid('news')` settled 0.01 USDG on Robinhood Chain.

Gateway: https://gateway.usenoren.xyz · Docs: https://docs.usenoren.xyz · Apache-2.0
