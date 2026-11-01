import Link from "next/link";
import { buildDocsMetadata, buildDocsJsonLd } from "../_meta";

const META_ARGS = ["mcp-server", "Noren MCP server", 'Connect any MCP client to Noren: read tools and a non-custodial payment flow on a hosted endpoint, and a local stdio server that can pay with your own key.'] as const;
export const metadata = buildDocsMetadata(...META_ARGS);

export default function McpServerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildDocsJsonLd(...META_ARGS)) }}
      />
      <h1>Noren MCP server</h1>
      <p>
        This page covers Noren as an MCP <em>server</em>: what an agent in
        Claude, Cursor or any other MCP client can call. Noren as an MCP{" "}
        <em>client</em>, where the daemon loads external servers, is on{" "}
        <Link href="/mcp">MCP integration</Link>.
      </p>
      <p>
        Every tool wraps something that is live today. There are no GPU,
        staking or escrow tools, because those do not exist yet.
      </p>

      <h2>Tools</h2>
      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>What it does</th>
            <th>Hosted</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>noren_gateway_stats</code></td>
            <td>Paid APIs, 402 challenges and settled payments on Robinhood Chain (<code>eip155:4663</code>).</td>
            <td>yes</td>
          </tr>
          <tr>
            <td><code>noren_list_apis</code></td>
            <td>The pay-per-call APIs with slug, path and price in USDG.</td>
            <td>yes</td>
          </tr>
          <tr>
            <td><code>noren_reputation</code></td>
            <td>Score and tier of a wallet, computed only from payments that settled, with the transaction hashes behind it.</td>
            <td>yes</td>
          </tr>
          <tr>
            <td><code>noren_leaderboard</code></td>
            <td>Top paying wallets.</td>
            <td>yes</td>
          </tr>
          <tr>
            <td><code>noren_verify_payment</code></td>
            <td>Reads a transaction from the chain RPC and returns its USDG transfers. It does not trust the gateway.</td>
            <td>yes</td>
          </tr>
          <tr>
            <td><code>noren_check_counterparty</code></td>
            <td>Guard check before you pay a wallet. Combines the gateway reputation with the wallet&apos;s on-chain transaction count and ETH balance and returns a verdict: <code>known_good</code> (5 or more settled payments and score 40 or higher), <code>limited_history</code> (1 to 4 settled payments) or <code>unknown</code>. It reflects Noren gateway history only and is not a guarantee.</td>
            <td>yes</td>
          </tr>
          <tr>
            <td><code>noren_payment_request</code></td>
            <td>Step 1 of paying from a hosted agent. Give an API slug and your wallet address. Returns the price, the approve transaction if your wallet needs one, and the EIP-712 data to sign. Nothing is spent.</td>
            <td>yes</td>
          </tr>
          <tr>
            <td><code>noren_submit_payment</code></td>
            <td>Step 2. Send the intent and the signature your wallet produced. The gateway settles USDG and returns the API result and the settlement transaction.</td>
            <td>yes</td>
          </tr>
          <tr>
            <td><code>noren_pay_call</code></td>
            <td>Calls one paid gateway API and pays for it over x402.</td>
            <td>no, local only</td>
          </tr>
        </tbody>
      </table>

      <h2>Hosted endpoint</h2>
      <p>
        Eight tools, three resources and two prompts are served over Streamable
        HTTP at <code>https://mcp.usenoren.xyz/mcp</code>: the read tools, the
        counterparty check and the two payment tools. It is stateless, takes no credentials, and allows 60
        requests per minute per address. The hosted process holds no key, so{" "}
        <code>noren_pay_call</code> is removed from its tool list.
      </p>
      <pre>
        <code>{`claude mcp add --transport http noren https://mcp.usenoren.xyz/mcp`}</code>
      </pre>
      <p>Any client that accepts a remote server URL takes the same address.</p>

      <h2>Resources and prompts</h2>
      <p>
        Clients that support them can read live data without a tool call, and
        start guided flows.
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Kind</th>
            <th>What it gives</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>noren://apis</code></td>
            <td>resource</td>
            <td>The paid API catalog with prices.</td>
          </tr>
          <tr>
            <td><code>noren://stats</code></td>
            <td>resource</td>
            <td>Gateway statistics: 402 challenges and settled payments.</td>
          </tr>
          <tr>
            <td><code>noren://wallet/{"{address}"}</code></td>
            <td>resource template</td>
            <td>Reputation of any wallet.</td>
          </tr>
          <tr>
            <td><code>buy_api</code></td>
            <td>prompt</td>
            <td>A guided, consent-first purchase of one API: price, your yes, wallet signature, settlement, verification.</td>
          </tr>
          <tr>
            <td><code>check_before_paying</code></td>
            <td>prompt</td>
            <td>Runs the counterparty check and summarises it in three lines.</td>
          </tr>
        </tbody>
      </table>
      <p>
        Every tool carries a title and read-only hints, so a client can tell
        the safe reads from the two that move money.
      </p>

      <h2>Paying from the hosted endpoint</h2>
      <p>
        An agent can buy an API without ever giving Noren a key. The wallet
        stays with you and signs locally.
      </p>
      <ol>
        <li>Call <code>noren_payment_request</code> with the API slug and your wallet address.</li>
        <li>If <code>needsApprove</code> is true, send the returned approve transaction from your wallet. It allows the gateway to move exactly the price in USDG, nothing more, and needs a little ETH for gas on Robinhood Chain.</li>
        <li>Sign the returned <code>typedData</code> with <code>eth_signTypedData_v4</code>.</li>
        <li>Call <code>noren_submit_payment</code> with the slug, the intent unchanged and the signature.</li>
      </ol>
      <p>
        On submit the server does not trust your copy of the intent. It
        fetches a fresh challenge and refuses the payment if the payee, the
        amount or the resource differs, or if the request is older than five
        minutes. The facilitator then checks the signature and the allowance
        on chain.
      </p>

      <h2>Local server with payments</h2>
      <p>
        If you would rather the agent pay by itself, <code>noren_pay_call</code>{" "}
        takes a key and spending caps. A key should never sit on someone
        else&apos;s server, so this runs on your machine over stdio and stays
        off until you set a key and two caps.
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "noren": {
      "command": "npx",
      "args": ["-y", "noren-mcp"],
      "env": {
        "NOREN_PAYER_KEY": "0x…",
        "NOREN_MAX_USDG_PER_CALL": "0.05",
        "NOREN_MAX_USDG_PER_DAY": "0.2"
      }
    }
  }
}`}</code>
      </pre>

      <h2>How a payment is guarded</h2>
      <ol>
        <li>The price comes from the gateway list. The model cannot pass or change it.</li>
        <li>Both caps are checked first. Missing or zero caps mean no payments.</li>
        <li>The tool requests the API and gets a <code>402</code>. It checks the network is <code>eip155:4663</code>, the asset is USDG and the amount does not exceed the listed price.</li>
        <li>It approves the gateway spender for exactly that amount, signs an EIP-712 payment intent with your key and settles through the facilitator.</li>
        <li>It redeems the receipt and returns the API result with the settlement transaction.</li>
      </ol>
      <p>
        The key is read in-process and never returned to the model, and error
        text is scrubbed of it. Use a dedicated wallet with a small balance. It
        also needs a little ETH for the approve transaction.
      </p>

      <h2>Checked, not claimed</h2>
      <p>
        The local payment tool was exercised through the MCP protocol against the live
        gateway. Two payments of 0.01 USDG went through{" "}
        <code>noren_pay_call</code>, each confirmed from the chain RPC rather
        than from the gateway, and a third call priced above the per-call cap
        was refused before any transaction.
      </p>
      <p>
        The hosted two-step flow is covered by unit tests: typed data that
        verifies against the payer, an approve step only when the allowance is
        short, and refusal of a changed payee, amount, resource or an expired
        request before the facilitator is ever called. On the live endpoint
        the request step and those refusals were run, and one payment went all
        the way through the hosted flow: a wallet asked for a payment, sent the
        approve transaction, signed the typed data and submitted it, the
        gateway settled 0.01 USDG on Robinhood Chain, and{" "}
        <code>noren_verify_payment</code> found the transfer on chain. The
        settlement is{" "}
        <a
          href="https://robinhoodchain.blockscout.com/tx/0x4dcf7eaf7cba64745722c8dced711a3d88ccea592ae6f6ca4afe04ead1874b5d"
          rel="noopener noreferrer"
          target="_blank"
        >
          0x4dcf7e…874b5d
        </a>
        . It was a single test payment from a test wallet, not a measure of
        usage. The script that repeats it is{" "}
        <code>services/noren-mcp/scripts/e2e-pay.mts</code> in the repository.
      </p>

      <h2>Limits</h2>
      <ul>
        <li>One payment per call, up to the price the gateway lists.</li>
        <li>Verification covers USDG transfers on Robinhood Chain.</li>
        <li>The daily total is kept in memory for the life of the process.</li>
      </ul>

      <h2>Related</h2>
      <ul>
        <li><Link href="/build-with-x402">Build with x402</Link>: the payment flow the tool follows.</li>
        <li><Link href="/security">Security</Link>: the trust model behind the caps.</li>
      </ul>
    </>
  );
}
