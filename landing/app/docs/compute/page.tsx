import Link from "next/link";
import { buildDocsMetadata, buildDocsJsonLd } from "../_meta";

const META_ARGS = [
  "compute",
  "Compute",
  "Planned metered compute on Robinhood Chain: GPU leases and paid inference settled in USDG. Coming soon.",
] as const;
export const metadata = buildDocsMetadata(...META_ARGS);

export default function ComputePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildDocsJsonLd(...META_ARGS)) }}
      />
      <h1>Compute</h1>
      <p>
        <strong>Status: coming soon.</strong> Noren Compute is the planned metered
        compute market on <strong>Robinhood Chain</strong> (chain id 4663): renters pay
        in USDG for the time or the requests they use, operators earn USDG, and gas is
        ETH. No coordinator, node network, contract, token, or price is live today, and
        none are published on this page.
      </p>

      <h2>Design</h2>
      <ul>
        <li>
          <strong>Leases.</strong> A renter opens a lease with a rate and a window. The
          ceiling (rate times window) is moved from the renter&apos;s balance into an
          escrow contract. When the lease closes, the meter commits and the escrow pays
          the operator for the seconds used and returns the rest to the renter. The
          repository&apos;s <code>SpendGrantEscrow</code> contract shows the bounded-spend
          pattern this builds on (see <Link href="/settlement">Settlement</Link>).
        </li>
        <li>
          <strong>Paid inference over x402.</strong> Agents buy AI inference per request,
          paying in USDG with an EIP-3009 authorization. See{" "}
          <Link href="/build-with-x402">Build with x402</Link>.
        </li>
        <li>
          <strong>Operators.</strong> Operators run a node that takes paid work. Staking
          the Noren token as a requirement to take work is planned; the Noren token contract is deployed on Robinhood Chain, but
          staking and any operator requirement are not live.
        </li>
        <li>
          <strong>Verification and faults.</strong> Planned: known-answer test jobs and
          signed verdicts, with proven faults reducing an operator&apos;s stake and
          reputation. Parameters are not final and are not published here.
        </li>
      </ul>

      <h2>What exists today</h2>
      <p>
        The repository contains the inference gateway, node, protocol, and verifier
        crates (<code>noren-inference-gateway</code>,{" "}
        <code>noren-inference-node</code>, <code>noren-inference-protocol</code>,{" "}
        <code>noren-inference-verifier</code>) and the x402 signing client. These
        are source-level components; a public service built on them is not running.
      </p>

      <h2>Endpoints and addresses</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Network</td>
            <td>Robinhood Chain, chain id 4663 (<code>eip155:4663</code>)</td>
          </tr>
          <tr>
            <td>Settlement asset</td>
            <td>USDG</td>
          </tr>
          <tr>
            <td>Gas</td>
            <td>ETH</td>
          </tr>
          <tr>
            <td>Coordinator / inference API</td>
            <td>Coming soon</td>
          </tr>
          <tr>
            <td>Escrow and settlement contracts</td>
            <td>Coming soon</td>
          </tr>
          <tr>
            <td>The Noren token</td>
            <td>Coming soon</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
