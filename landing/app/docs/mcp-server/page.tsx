import Link from "next/link";
import { buildDocsMetadata, buildDocsJsonLd } from "../_meta";

const META_ARGS = ["mcp-server", "Noren MCP server", 'Connect any MCP client to Noren: read tools on a hosted endpoint, and a local stdio server that can pay for gateway APIs in USDG on Robinhood Chain.'] as const;
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
            <td><code>noren_pay_call</code></td>
            <td>Calls one paid gateway API and pays for it over x402.</td>
            <td>no, local only</td>
          </tr>
        </tbody>
      </table>

      <h2>Hosted endpoint</h2>
      <p>
        The five read tools are served over Streamable HTTP at{" "}
        <code>https://mcp.usenoren.xyz/mcp</code>. It is stateless, takes no
        credentials, and allows 60 requests per minute per address. The hosted
        process holds no key and the payment tool is removed from its tool
        list.
      </p>
      <pre>
        <code>{`claude mcp add --transport http noren https://mcp.usenoren.xyz/mcp`}</code>
      </pre>
      <p>Any client that accepts a remote server URL takes the same address.</p>

      <h2>Local server with payments</h2>
      <p>
        <code>noren_pay_call</code> needs a key, and a key should never sit on
        someone else&apos;s server, so payment runs on your machine over stdio.
        It stays off until you set a key and two caps.
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
        The tool was exercised through the MCP protocol against the live
        gateway. Two payments of 0.01 USDG went through{" "}
        <code>noren_pay_call</code>, each confirmed from the chain RPC rather
        than from the gateway, and a third call priced above the per-call cap
        was refused before any transaction.
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
