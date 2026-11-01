import Link from "next/link";
import { buildDocsMetadata, buildDocsJsonLd } from "../_meta";

const META_ARGS = [
  "zauth",
  "Noren and zauth",
  "Discovery and health-monitoring for Noren x402 endpoints through the zauth provider hub.",
] as const;
export const metadata = buildDocsMetadata(...META_ARGS);

export default function ZauthPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildDocsJsonLd(...META_ARGS)) }}
      />
      <h1>Noren and zauth</h1>
      <p>
        zauth runs a provider hub for x402: a directory that discovers public
        x402 endpoints, health-checks them, and exposes provider telemetry.
        Noren integrates with it so the paid resources Noren exposes are
        discoverable and monitored, and so Noren agents can read the
        directory when looking for paid services.
      </p>

      <h2>Crate</h2>
      <p>
        <code>noren-zauth</code> (in <code>agent-os/crates/</code>) is the
        Rust client:
      </p>
      <ul>
        <li>
          <strong>Directory client:</strong> query the zauth provider hub for
          registered x402 endpoints (URL, network, health).
        </li>
        <li>
          <strong>x402 v2 header decoder:</strong> decode the{" "}
          <code>payment-required</code> challenge an x402 resource returns into
          the typed requirements Noren signs against.
        </li>
        <li>
          <strong>RepoScan request builder:</strong> construct RepoScan requests
          against the zauth verifier for an endpoint under test.
        </li>
      </ul>
      <p>
        The signing path reuses <Link href="/x402">noren-x402</Link> (
        <code>EvmSigner</code>); zauth adds no new key handling.
      </p>

      <h2>Integration status</h2>
      <p>
        The client crate is implemented. Registering a Noren seller in the zauth
        provider hub requires a live public x402 seller on Robinhood Chain, which is{" "}
        <strong>coming soon</strong>. No Noren endpoint is registered or
        monitored yet.
      </p>
      <p>
        One operational detail worth stating plainly: a hub registers a selling
        endpoint only once it processes a real settled payment, not on SDK install
        or on <code>402</code> challenge telemetry. An endpoint appears in a
        directory after its first successful settlement, and drops out when its
        health check stops passing.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/x402">Noren x402</Link>: the payment layer zauth
          discovers and monitors.
        </li>
        <li>
          <Link href="/settlement">Settlement</Link>: how Noren accounts for
          paid calls.
        </li>
      </ul>
    </>
  );
}
