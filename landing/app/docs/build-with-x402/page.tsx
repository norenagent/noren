import Link from "next/link";
import { buildDocsMetadata, buildDocsJsonLd } from "../_meta";

const META_ARGS = [
  "build-with-x402",
  "Build with x402",
  "Accept x402 payments in USDG on Robinhood Chain (eip155:4663) and pay for resources from an agent. Noren runs a live x402 gateway and facilitator at gateway.usenoren.xyz; paid compute is coming soon.",
] as const;
export const metadata = buildDocsMetadata(...META_ARGS);

const sellerInstall = `npm install express @x402/express @x402/core @x402/evm`;

const sellerCode = `import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';

const app = express();
app.use(express.json());

// Any x402 facilitator that supports eip155:4663 works. Noren's is live at https://gateway.usenoren.xyz/facilitator.
const facilitator = new HTTPFacilitatorClient({ url: process.env.FACILITATOR_URL });
const server = new x402ResourceServer(facilitator)
  .register('eip155:4663', new ExactEvmScheme());

app.use(paymentMiddleware({
  'POST /api/intel': {
    accepts: [
      { scheme: 'exact', price: '$0.01', network: 'eip155:4663', payTo: '0xYourReceivingAddress' },
    ],
    description: 'Street intel for one district',
  },
}, server));

app.post('/api/intel', (req, res) => res.json({ district: req.body.district, heat: 3 }));
app.listen(3000);`;

const buyerInstall = `npm install @x402/fetch @x402/evm viem`;

const buyerCode = `import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

const client = new x402Client();
registerExactEvmScheme(client, {
  signer: privateKeyToAccount(process.env.AGENT_PRIVATE_KEY),
  // A spending rule: never pay more than 0.04 USDG (6 decimals) for one call.
  policies: [(version, offers) => offers.filter(offer => BigInt(offer.amount) <= 40_000n)],
});
const pay = wrapFetchWithPayment(fetch, client);

const response = await pay('https://seller.example/api/intel', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ district: 'Lowline' }),
});
console.log(await response.json());`;

export default function BuildWithX402Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildDocsJsonLd(...META_ARGS)) }}
      />
      <h1>Build with x402</h1>
      <p>
        x402 lets a product charge per request over plain HTTP: an unpaid call gets{" "}
        <code>402 Payment Required</code> with a price, and a paid retry gets the
        response. On Noren&apos;s settlement chain, <strong>Robinhood Chain</strong>{" "}
        (chain id 4663, CAIP-2 id <code>eip155:4663</code>), payments are in{" "}
        <strong>USDG</strong> and gas is ETH.
      </p>
      <p>
        <strong>Status: live.</strong> Noren operates an x402 gateway and facilitator
        for USDG on Robinhood Chain at{" "}
        <a href="https://gateway.usenoren.xyz/facilitator">gateway.usenoren.xyz</a>.
        Unpaid requests to its paid routes return a real <code>402</code> challenge, and
        signed payments settle on-chain. Paid compute is not live yet. The code below
        shows the shape of an integration using the open x402 libraries; you can point
        it at any facilitator that supports <code>eip155:4663</code>, including
        Noren&apos;s.
      </p>

      <h2 id="facilitator">Accept payments (seller)</h2>
      <p>
        A seller adds payment middleware to its routes and points it at a facilitator
        that supports <code>eip155:4663</code>. USDG on this chain does implement
        EIP-3009 (checked on-chain: <code>transferWithAuthorization</code> succeeds and{" "}
        <code>authorizationState</code> is readable), but Noren&apos;s facilitator
        currently settles with an <code>approve</code> + <code>transferFrom</code>{" "}
        pattern instead: the buyer signs an EIP-712 payment intent, and the facilitator
        submits the transfer and pays that transaction&apos;s ETH gas. The seller needs no wallet infrastructure beyond a
        receiving address.
      </p>
      <pre>
        <code>{sellerInstall}</code>
      </pre>
      <pre>
        <code>{sellerCode}</code>
      </pre>

      <h3>Limits and caveats</h3>
      <ul>
        <li>
          Confirm the USDG token address and its EIP-712 domain (name and version) for
          network 4663 from an official source before you configure a route.
        </li>
        <li>
          A facilitator that cannot settle returns <code>402</code> and the resource is
          not released, so a buyer is never charged for a failed call.
        </li>
        <li>
          Smart-contract wallets must already be deployed before they can sign
          authorizations that a token contract will accept.
        </li>
      </ul>

      <h2 id="agents">Pay from an agent (buyer)</h2>
      <p>
        An agent needs a secp256k1 key holding USDG. Because Noren&apos;s facilitator
        settles with <code>transferFrom</code> rather than an EIP-3009 authorization, the
        buyer first sets a one-time ERC-20 allowance for the facilitator&apos;s spender
        address (published at <a href="https://gateway.usenoren.xyz/facilitator">
        /facilitator</a>), which costs a small amount of ETH once. After that, each paid
        call is a locally signed EIP-712 intent with no RPC, and the facilitator pays
        gas for the settlement.
      </p>
      <pre>
        <code>{buyerInstall}</code>
      </pre>
      <pre>
        <code>{buyerCode}</code>
      </pre>
      <p>
        Inside Noren, the daemon does this for you: the{" "}
        <code>noren-x402-signer-evm</code> sidecar signs the payment, the daemon
        debits the agent&apos;s budget, writes a settlement receipt, and records the
        call in the audit log. See <Link href="/x402">Noren x402</Link>.
      </p>

      <h2 id="compute">Paid inference and research (coming soon)</h2>
      <p>
        Noren plans to offer metered AI inference and research jobs payable over x402
        in USDG. These services are coming soon; no public endpoint, model list, or price
        exists today. See <Link href="/compute">Compute</Link> for what is planned.
      </p>

      <h2 id="agent-games">Using it in an agent game</h2>
      <p>
        Any HTTP route can be priced with the seller setup above, for example premium
        data, hints, or entry to side events. Agents pay in USDG with no account. Each
        request is paid on its own, so it fits turn decisions and daily challenges better
        than real-time action.
      </p>

      <h2>Links</h2>
      <ul>
        <li>
          <Link href="/x402">Noren x402</Link>: how agents built on Noren pay for
          and sell services over x402.
        </li>
        <li>
          <Link href="/compute">Compute</Link> (coming soon).
        </li>
        <li>
          The x402 protocol: <a href="https://x402.org">x402.org</a>.
        </li>
      </ul>
    </>
  );
}
