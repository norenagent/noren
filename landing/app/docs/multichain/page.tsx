import Link from "next/link";
import { buildDocsMetadata, buildDocsJsonLd } from "../_meta";

const META_ARGS = [
  "multichain",
  "Robinhood Chain",
  "Noren settles on Robinhood Chain (chain id 4663) in USDG, with ETH for gas. Trust data is signed off-chain and verifiable with a plain ecrecover. Contracts are coming soon.",
] as const;
export const metadata = buildDocsMetadata(...META_ARGS);

export default function MultichainPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildDocsJsonLd(...META_ARGS)) }}
      />
      <h1>Robinhood Chain</h1>
      <p>
        Noren&apos;s settlement chain is <strong>Robinhood Chain</strong> (chain id
        4663). The settlement asset is <strong>USDG</strong> and the native gas token is
        ETH. <strong>Nothing is deployed on-chain yet</strong>: every contract, token, and
        endpoint on this page is <em>coming soon</em>, and no addresses are published
        until they exist.
      </p>

      <h2>Design: signed data, verified with ecrecover</h2>
      <p>
        Noren&apos;s trust records (identity, audit-derived reputation, and bond
        receipts) are produced off-chain by the daemon and signed. The signing
        scheme is chosen so that an EVM contract can check them cheaply: a
        secp256k1 issuer key signs an EIP-712 typed-data digest, and the contract
        recovers the signer with a single <code>ecrecover</code> and compares it
        against a trusted-signer set. There is no bridge and no relayer that has to be
        trusted for correctness; the signature is the proof.
      </p>
      <p>
        The Rust crates <code>noren-attestation</code> and{" "}
        <code>noren-evm-signer</code> in the repository build and sign these
        artifacts. The Solidity verifiers live in{" "}
        <code>agent-os/evm/contracts</code>.
      </p>

      <h2>What is in the repository</h2>
      <table>
        <thead>
          <tr>
            <th>Contract</th>
            <th>Purpose</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>BondReceiptVerifier</code></td>
            <td>
              Verifies a Noren-signed EIP-712 bond receipt (token, bond, window,
              slash split) with <code>ecrecover</code>. Rejects expired receipts,
              untrusted signers, and malleable signatures.
            </td>
            <td>Source and tests; coming soon on-chain</td>
          </tr>
          <tr>
            <td><code>NorenReputationRegistry</code></td>
            <td>
              Accepts a signed reputation update for a subject and stores it; stale
              updates and out-of-range scores revert.
            </td>
            <td>Source and tests; coming soon on-chain</td>
          </tr>
          <tr>
            <td><code>SpendGrantEscrow</code></td>
            <td>
              Bounded agent spend in USDG: per-call ceiling, funded cap, expiry,
              provider allowlist, and release gated on an attestor&apos;s quality
              verdict. See <Link href="/settlement">Settlement</Link>.
            </td>
            <td>Source and tests; coming soon on-chain</td>
          </tr>
          <tr>
            <td><code>RwaTradeGuard</code>, <code>GuardedTradeExecutor</code></td>
            <td>
              Price-band, notional-cap, and rolling-window guards for agent trades of
              tokenized assets through an allowlisted router.
            </td>
            <td>Source and tests; coming soon on-chain</td>
          </tr>
        </tbody>
      </table>

      <h2>Payments: USDG over x402</h2>
      <p>
        Per-call payments use the x402 <code>exact</code> scheme on network{" "}
        <code>eip155:4663</code>. The payer signs an EIP-3009{" "}
        <code>transferWithAuthorization</code> over USDG; a facilitator submits it and
        pays gas, so a paying agent needs no ETH and no RPC to sign. See{" "}
        <Link href="/x402">Noren x402</Link>. The public facilitator and sellers are
        coming soon.
      </p>

      <h2>The Noren token</h2>
      <p>
        <strong>The Noren token</strong> is deployed on Robinhood Chain at{" "}
        <code>0xd7ccebb9a014a713879093979c7016db72486e62</code>. Verify it on the explorer and on
        the official token page. There is no price or market data here, and no address other than this one is ours.
      </p>

      <h2>Planned integrations with other EVM ecosystems</h2>
      <p>
        Because trust data is signed with standard EVM primitives, it can later be
        projected into other EVM ecosystems without moving any asset. These are{" "}
        <strong>planned</strong>, with no deployments today:
      </p>
      <ul>
        <li>
          Registering the agent in an ERC-8004 identity registry, if and where one is
          deployed (the repository contains staging tooling that builds calldata and
          never signs or submits).
        </li>
        <li>
          Projecting reputation as off-chain EAS attestations signed by the same
          secp256k1 issuer key.
        </li>
        <li>
          Name resolution through an ENS-style offchain (CCIP-Read) resolver; an{" "}
          <code>OffchainResolver</code> contract and gateway exist as source.
        </li>
      </ul>

      <h2>What comes next</h2>
      <p>
        Deploy the contracts above to Robinhood Chain, publish addresses and
        verification instructions, then turn on the daemon-driven receipt flush. Track
        progress on <a href="https://usenoren.xyz/roadmap">the roadmap</a>.
      </p>
    </>
  );
}
