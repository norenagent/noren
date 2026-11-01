import Link from "next/link";
import { buildDocsMetadata, buildDocsJsonLd } from "../_meta";

const META_ARGS = [
  "x402",
  "Noren x402",
  "Pay-per-call USDG over HTTP 402 on Robinhood Chain: Noren agents pay for resources, and Noren exposes paid resources to other agents.",
] as const;
export const metadata = buildDocsMetadata(...META_ARGS);

export default function X402Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildDocsJsonLd(...META_ARGS)) }}
      />
      <h1>Noren x402</h1>
      <p>
        x402 is HTTP <code>402 Payment Required</code> turned into a working
        payment rail. A resource answers an unpaid request with a signed price
        quote, the caller pays, and the same request retried with an{" "}
        <code>X-PAYMENT</code> header returns the resource. Noren uses x402 in
        both directions: agents pay for external resources, and Noren exposes
        paid resources to other agents.
      </p>
      <p>
        <strong>Status:</strong> the signing client is implemented in the repository,
        and Noren operates a live x402 gateway and facilitator on Robinhood Chain at{" "}
        <a href="https://gateway.usenoren.xyz/facilitator">gateway.usenoren.xyz</a>.
        The Noren-signed trust-read seller described below is not live yet. To accept
        x402 payments in your own product, see{" "}
        <Link href="/build-with-x402">Build with x402</Link>.
      </p>
      <p>
        Both directions run through one accounting path. Settlement, budgeting,
        audit, and attestation are shared, so a paid call is a first-class,
        capability-gated, audited action rather than a side channel.
      </p>

      <h2>Crates</h2>
      <table>
        <thead>
          <tr>
            <th>Crate</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>noren-x402</code>
            </td>
            <td>
              Core types (<code>PaymentRequirements</code>,{" "}
              <code>PaymentExtra</code>), the <code>Signer</code> trait, and{" "}
              <code>EvmSigner</code>, which signs EIP-3009 authorizations over
              EIP-712 typed data.
            </td>
          </tr>
          <tr>
            <td>
              <code>noren-x402-signer-evm</code>
            </td>
            <td>
              A stdin/stdout sidecar binary: read a{" "}
              <code>PaymentRequirements</code> JSON on stdin, get the base64{" "}
              <code>X-PAYMENT</code> header value on stdout. Keeps the secp256k1
              key out of the daemon process.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Money path (Robinhood Chain)</h2>
      <ul>
        <li>
          <strong>Network and asset:</strong> Robinhood Chain, chain id 4663, CAIP-2
          id <code>eip155:4663</code>. The asset is USDG (an ERC-20 with 6 decimals
          that supports EIP-3009). Native gas is ETH.
        </li>
        <li>
          <strong>Signature:</strong> the payer signs an EIP-3009{" "}
          <code>TransferWithAuthorization</code> (<code>from</code>, <code>to</code>,{" "}
          <code>value</code>, <code>validAfter</code>, <code>validBefore</code>,{" "}
          <code>nonce</code>) over the token&apos;s EIP-712 domain. Signing is a
          local keccak and secp256k1 operation: no transaction is built and no RPC
          is needed.
        </li>
        <li>
          <strong>Facilitator:</strong> a facilitator submits the signed
          authorization to the token&apos;s <code>transferWithAuthorization</code>{" "}
          and pays the ETH gas. Noren&apos;s facilitator is live at gateway.usenoren.xyz;
          today it settles with <code>approve</code> + <code>transferFrom</code> rather
          than an EIP-3009 authorization (see Build with x402).
        </li>
        <li>
          <strong>Roles:</strong> the payer signs; the facilitator submits and
          settles; the recipient (<code>payTo</code>) receives the USDG. Payer and
          recipient are always distinct accounts.
        </li>
        <li>
          <strong>Fail closed:</strong> if the signer cannot pin the token&apos;s
          EIP-712 domain, or the network is not an EVM network it recognizes, it
          refuses to sign. If the facilitator cannot settle, the caller receives a{" "}
          <code>402</code> and the resource is never released.
        </li>
      </ul>

      <h2>Paying for resources (outbound)</h2>
      <p>
        An agent reaches a paid provider through capability-gated MCP tools. The
        daemon signs the x402 payment with the agent funding key, debits the
        agent budget, writes a settlement receipt, and records the call in the
        hash-chained audit log. The agent never holds raw payment plumbing; it
        calls a tool and gets a result.
      </p>
      <p>
        The <code>noren-x402-signer-evm</code> sidecar is the reusable
        primitive: feed it the <code>PaymentRequirements</code> from any{" "}
        <code>402</code> challenge and it returns the header to retry with.
      </p>
      <pre>
        <code>{`export NOREN_X402_EVM_KEY=/path/to/funder.hex   # 32-byte secp256k1 secret as hex
echo "$payment_requirements_json" | noren-x402-signer-evm   # -> base64 X-PAYMENT header`}</code>
      </pre>
      <p>
        A challenge for Robinhood Chain looks like this (the asset address is filled
        in once USDG is confirmed for the target network):
      </p>
      <pre>
        <code>{`{
  "scheme":   "exact",
  "network":  "eip155:4663",
  "asset":    "<USDG token address>",
  "payTo":    "0x<recipient>",
  "maxAmountRequired": "10000",   // 0.01 USDG (6 decimals)
  "extra":    { "name": "<EIP-712 domain name>", "version": "<domain version>" }
}`}</code>
      </pre>

      <h2>Exposing a paid resource (inbound)</h2>
      <p>
        Noren&apos;s gateway at <code>gateway.usenoren.xyz</code> already serves paid
        routes that return a real <code>402</code> challenge and settle in USDG on
        Robinhood Chain; discovery is at <code>/.well-known/x402</code>. Noren-signed
        trust reads (attestations over a claim, reputation reads, and bond-receipt
        checks) are <strong>coming soon</strong> as paid routes, and no prices are
        published for them yet.
      </p>
      <p>
        Unpaid, a paid route returns an x402 <code>402</code> challenge: the{" "}
        <code>exact</code> scheme, network <code>eip155:4663</code>, USDG, and a{" "}
        <code>payTo</code> address. Pay and retry to receive the signed result.
        Returning a status of 400 or higher from the resource cancels settlement, so a
        caller is never charged for an error.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/zauth">Noren and zauth</Link>: discovery and
          health-monitoring for x402 endpoints.
        </li>
        <li>
          <Link href="/settlement">Settlement</Link>: how Noren accounts for
          paid calls.
        </li>
        <li>
          <Link href="/mcp">MCP integration</Link>: how agents reach paid tools.
        </li>
      </ul>
    </>
  );
}
