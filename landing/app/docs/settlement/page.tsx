import Link from "next/link";
import { buildDocsMetadata, buildDocsJsonLd } from "../_meta";

const META_ARGS = ["settlement", "Settlement", 'Local receipts, credit accounting, and the planned Robinhood Chain settlement contracts (coming soon).'] as const;
export const metadata = buildDocsMetadata(...META_ARGS);

export default function SettlementPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildDocsJsonLd(...META_ARGS)) }}
      />
      <h1>Settlement</h1>
      <p>
        Settlement is how Noren accounts for resource consumption.
        Today the daemon writes local receipts. The settlement chain is{" "}
        <strong>Robinhood Chain</strong> (chain id 4663): the settlement asset
        is USDG and gas is paid in ETH. Nothing is deployed on-chain yet; the
        contracts and the daemon-driven path that batches receipts and anchors
        them on-chain are <strong>coming soon</strong>.
      </p>

      <h2>Receipt</h2>
      <pre>
        <code>{`SettlementReceipt {
  id:               uuid,
  payer:            AgentId,            // who consumed resources
  resource:         "memory" | "compute" | "tool" | "message" | "registration",
  credits_consumed: u64,
  settled_at:       u64,                // unix milliseconds
  memory_record_id: uuid | null,        // set when resource == "memory"
  chain:            string | null,      // e.g. "robinhood-4663" once anchored on-chain
  cluster:          string | null,      // network label (mainnet / testnet) once anchored
  batch_id:         string | null,      // identifier of the receipt batch
  merkle_root:      string | null,      // batch merkle root to be committed on-chain
  tx_sig:           string | null,      // transaction reference of the anchoring tx (tx hash on EVM)
  slot:             u64 | null,         // block number where the batch confirmed
  confirmed_at:     u64 | null,         // unix milliseconds at confirmation
  onchain_sig:      string | null       // populated when flushed on-chain
}`}</code>
      </pre>

      <p>
        Receipts accumulate in{" "}
        <code>$NOREN_HOME/receipts/working.jsonl</code>. The daemon
        writes one receipt per resource event. For example, every
        memory write produces a receipt with{" "}
        <code>{'resource = "memory"'}</code>,{" "}
        <code>memory_record_id</code>, and <code>credits_consumed</code>{" "}
        proportional to bytes written.
      </p>

      <h2>Credit pricing</h2>
      <p>
        Each resource kind has a pricing function that maps the
        underlying unit (bytes, milliseconds, calls) to credits. The
        pricing functions are deliberately simple and live in one
        place, so operators can audit them at a glance and downstream
        integrations can replicate the math without a dependency.
      </p>

      <p>
        The default for memory writes is one credit per kilobyte (round
        up). Compute, tool calls, and egress have their own pricing
        functions that compose the same way.
      </p>

      <h2>Planned on-chain flush (coming soon)</h2>
      <p>
        The on-chain side is planned as Solidity contracts on Robinhood Chain
        (built and tested with Foundry), with USDG as the settlement asset and
        ETH for gas. Credits are meant to be USD-pegged accounting units. The
        shape under design:
      </p>

      <ul>
        <li>
          <strong>Buy credits:</strong> pay USDG into a treasury in exchange
          for credits at a configured rate.
        </li>
        <li>
          <strong>Consume credits:</strong> destroy credits at the point of
          consumption (memory write, tool call, etc.), with a{" "}
          <code>receipt_hash</code> that binds the on-chain consumption to a
          specific local receipt batch for reconciliation.
        </li>
        <li>
          <strong>Anchor a receipt batch:</strong> commit the batch merkle
          root so any receipt can be proven against it.
        </li>
      </ul>

      <p>
        None of this is deployed. The intended production flow is for the
        daemon to batch local receipts and submit consumption to the
        contracts; once the transaction confirms, the receipt&apos;s{" "}
        <code>onchain_sig</code> can be populated with the transaction hash.
        The existing field names (<code>tx_sig</code>, <code>slot</code>) are
        retained for compatibility; on an EVM chain they carry a transaction
        hash and a block number. This reconciliation path is not yet
        production.
      </p>

      <h3>EVM contracts in the repository</h3>
      <p>
        The repository already contains Solidity contracts under{" "}
        <code>agent-os/evm/contracts</code>, with Foundry tests. They are
        source only and are <strong>not deployed</strong> (coming soon):
      </p>
      <ul>
        <li>
          <code>SpendGrantEscrow</code>: a funder parks USDG behind a grant
          that bounds what a delegated agent may spend (per-call ceiling,
          total cap, expiry, provider allowlist). Funds for a call sit in a
          per-call hold and are released on delivery or on an attestor&apos;s
          EIP-712 quality verdict; with no passing verdict by the deadline the
          hold can be refunded.
        </li>
        <li>
          <code>BondReceiptVerifier</code> and{" "}
          <code>NorenReputationRegistry</code>: stateless/low-state
          verifiers that check Noren-signed EIP-712 receipts with{" "}
          <code>ecrecover</code>.
        </li>
        <li>
          <code>RwaTradeGuard</code> and <code>GuardedTradeExecutor</code>:
          policy guards (price band, notional cap, rolling spend window) for
          agent trades of tokenized assets.
        </li>
      </ul>

      <h2>Planned economic model</h2>
      <p>
        The target model is credits minted against an external payment
        input, credits consumed at resource-use time, and treasury policy
        that can route a portion of inflows toward provider payout. Those
        mechanics require contract audits, authority decisions, and
        deployment review before they should be treated as operational.
      </p>

      <h2>Storage layout</h2>
      <table>
        <thead>
          <tr>
            <th>Path</th>
            <th>Format</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>receipts/working.jsonl</code>
            </td>
            <td>JSONL, append-only</td>
            <td>
              Local receipts. Future flushed receipts can populate{" "}
              <code>onchain_sig</code>.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Reading recent receipts</h2>
      <pre>
        <code>{`noren chain status --json
noren receipts recent --limit 20 --json
noren chain flush-receipts --limit 20 --json
noren chain receipt-batches --limit 20 --json
# Or via HTTP:
curl -s '127.0.0.1:8421/receipts/recent?limit=20&since_ms=1714938000000' | jq`}</code>
      </pre>

      <h2>Verification</h2>
      <p>
        <code>noren verify --json</code> cross-checks memory writes against
        settlement receipts by <code>memory_record_id</code> when the
        receipt carries one, with owner/resource count fallback for older
        rows. Missing, duplicate, orphaned, or wrong-payer correlations
        surface as drift. The daemon is fail-soft on receipt write (a
        failed receipt does not cancel the memory write), so drift in this
        dimension is the principal operator-visible indicator of a
        settlement-side fault.
      </p>

      <h2>Backfill</h2>
      <p>
        When <code>noren verify</code> reports legacy receipts without a{" "}
        <code>memory_record_id</code> correlation, the operator can repair
        them with the{" "}
        <code>noren settlement backfill-receipts --json</code> CLI verb
        (HTTP equivalent: <code>POST /settlement/receipts/backfill</code>).
        Verify remains read-only; the backfill mutator runs only when
        explicitly invoked. The verb applies by default; pass{" "}
        <code>--dry-run</code> to report the <code>row_count</code> an
        apply would change without writing. Dry-run requires the{" "}
        <code>settlement.backfill.dry_run</code> capability; apply requires{" "}
        <code>settlement.backfill.apply</code>. See{" "}
        <Link href="/docs/capabilities">capabilities</Link> for the scope
        contract. An apply path writes a rollback checkpoint sibling file
        before mutation, fsyncs both the rewrite and the rename, then emits
        an operator-issued <code>SettlementReceiptBackfillApplied</code>{" "}
        audit row carrying <code>row_count</code>,{" "}
        <code>rollback_path</code>, and <code>dry_run</code>.
      </p>
      <pre>
        <code>{`$ noren settlement backfill-receipts --dry-run --json
{"schema":"noren.settlement.backfill.v1","row_count":12,"rollback_path":null,"dry_run":true}`}</code>
      </pre>

      <h2>x402 payment rail</h2>
      <p>
        Distinct from the internal receipt flush above, Noren includes an
        agent-to-service payment rail over HTTP 402 (x402). The daemon can pay
        for metered x402 resources outbound by signing an EIP-3009{" "}
        <code>transferWithAuthorization</code> over USDG on network{" "}
        <code>eip155:4663</code>. Public seller and facilitator endpoints on
        Robinhood Chain are <strong>coming soon</strong>. See{" "}
        <Link href="/x402">Noren x402</Link>. The payment rail is a
        separate concern from anchoring internal resource receipts.
      </p>

      <h2>Release</h2>
      <p>
        Local receipts and recent-receipt reads are implemented. The Robinhood
        Chain settlement contracts (credits, escrow, on-chain receipt
        anchoring) are coming soon and not deployed. The daemon-driven
        per-intent settlement lifecycle that anchors internal resource
        receipts is not yet production.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/architecture">Architecture</Link>: the
          settlement program in the broader system map.
        </li>
        <li>
          <Link href="/identity">Identity and keys</Link>: the
          same local identity signs capability grants today and is the
          planned signer boundary for future settlement transactions.
        </li>
        <li>
          <Link href="/audit">Audit log</Link>: settlement
          receipts pair 1:1 with memory writes; drift shows up here.
        </li>
      </ul>
    </>
  );
}
