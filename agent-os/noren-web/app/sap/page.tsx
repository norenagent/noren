import Link from "next/link";
import { PageHeader } from "../components/PageHeader";

export const dynamic = "force-dynamic";

export default function SettlementPage() {
  return (
    <>
      <PageHeader
        eyebrow="Advanced · onchain settlement"
        title="Settlement: coming soon on Robinhood Chain"
        subhead="Noren will settle agent work in USDG on Robinhood Chain (chain id 4663). Nothing is deployed yet, so this page shows no addresses, transactions or balances."
      />

      <section className="metric-row">
        <article className="metric">
          <span className="eyebrow">Chain</span>
          <span className="value small">Robinhood Chain</span>
          <span className="caption">chain id 4663</span>
        </article>
        <article className="metric">
          <span className="eyebrow">Settlement asset</span>
          <span className="value small">USDG</span>
          <span className="caption">stable-value settlement</span>
        </article>
        <article className="metric">
          <span className="eyebrow">Gas</span>
          <span className="value small">ETH</span>
          <span className="caption">native token of the chain</span>
        </article>
        <article className="metric">
          <span className="eyebrow">The Noren token contract</span>
          <span className="value small">Coming soon</span>
          <span className="caption">no address published yet</span>
        </article>
      </section>

      <section className="steps">
        <article className="step">
          <span className="n">1</span>
          <h3>Task runs</h3>
          <p>An agent does the work in the sandbox and signs every step it takes.</p>
        </article>
        <article className="step">
          <span className="n">2</span>
          <h3>Credits are metered</h3>
          <p>Usage is recorded by the daemon today. See it on the Spending page.</p>
        </article>
        <article className="step">
          <span className="n">3</span>
          <h3>Settle in USDG</h3>
          <p>Receipts will be anchored and paid on Robinhood Chain once contracts ship.</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Status</p>
            <h2>What is live today</h2>
          </div>
          <span className="chip-soon">Coming soon on Robinhood Chain</span>
        </div>
        <p className="empty">
          The sandbox runs real agents with signed, verifiable activity logs. Onchain settlement is
          not live: no contracts, transactions or token have been deployed. Local credit metering is
          available on the <Link href="/settlement" className="onchain-link">Spending</Link> page.
        </p>
      </section>
    </>
  );
}
