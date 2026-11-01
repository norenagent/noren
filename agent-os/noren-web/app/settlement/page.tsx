"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { formatDateTime, formatTimestamp, shortHash } from "@/lib/format";
import { usePoll } from "@/lib/usePoll";
import { PageHeader } from "../components/PageHeader";
import { DataGate, Tile } from "@/lib/ui";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

async function loadSettlement() {
  const [receipts, debits] = await Promise.all([
    api.recentReceipts(40),
    api.recentDebits(40),
  ]);
  return { receipts: receipts.receipts, debits: debits.debits };
}

export default function SettlementPage() {
  const { data, error, lastSyncMs, refresh } = usePoll(loadSettlement, 5000);
  const receipts = data?.receipts ?? [];
  const debits = data?.debits ?? [];
  const totalCredits = receipts.reduce((s, r) => s + r.credits_consumed, 0);

  return (
    <>
      <PageHeader
        eyebrow="Advanced · credits consumed"
        title="Spending"
        subhead={
          DEMO_MODE
            ? "Credits used by tasks on this sandbox, as recorded by the daemon. Onchain settlement on Robinhood Chain (USDG) is coming soon. Shared tally; resets every 12 hours."
            : "Credits used by your agents, as recorded by the local daemon. Onchain settlement on Robinhood Chain (USDG) is coming soon."
        }
        syncMs={lastSyncMs}
        error={error}
      />

      <DataGate loading={!data} error={error} onRetry={refresh} rows={3}>
      <section className="metric-row">
        <article className="metric">
          <span className="eyebrow">Local receipts</span>
          <span className="value">{receipts.length}</span>
          <span className="caption">{totalCredits} credits</span>
        </article>
        <article className="metric">
          <span className="eyebrow">Debits</span>
          <span className="value">{debits.length}</span>
          <span className="caption">matched to charges</span>
        </article>
        <article className="metric">
          <span className="eyebrow">Settlement asset</span>
          <span className="value small">USDG</span>
          <span className="caption">on Robinhood Chain</span>
        </article>
        <article className="metric">
          <span className="eyebrow">Onchain status</span>
          <span className="value small">Coming soon</span>
          <span className="caption">
            <Link href="/sap" className="onchain-link">
              see settlement plan
            </Link>
          </span>
        </article>
      </section>

      <section className="split-2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Local · operator-only</p>
              <h2>
                Daemon receipts <span className="count">{receipts.length}</span>
              </h2>
            </div>
          </div>
          {receipts.length === 0 ? (
            <p className="empty">
              No receipts yet. Receipts are issued when a task is charged to a local payer. This sandbox runs
              tasks free, so nothing is charged.
            </p>
          ) : (
            <div className="records">
              {receipts.map((r) => (
                <article key={r.id} className="record fade-up">
                  <div className="ts">
                    {formatDateTime(r.settled_at)}
                    <em>{r.resource}</em>
                  </div>
                  <div className="body">
                    <strong>{r.payer.display}</strong>
                    <p>
                      {r.credits_consumed} {r.credits_consumed === 1 ? "credit" : "credits"} ·{" "}
                      local only
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Local · operator-only</p>
              <h2>
                Daemon debits <span className="count">{debits.length}</span>
              </h2>
            </div>
          </div>
          {debits.length === 0 ? (
            <p className="empty">
              No debits yet. They appear alongside receipts when credits are spent.
            </p>
          ) : (
            <div className="records">
              {debits.map((d) => (
                <article key={d.paired_receipt} className="record fade-up">
                  <div className="ts">
                    {formatTimestamp(d.at_ms)}
                    <em>spent</em>
                  </div>
                  <div className="body">
                    <strong>{d.agent.display}</strong>
                    <p>
                      Used {d.credits} {d.credits === 1 ? "credit" : "credits"} · receipt{" "}
                      {shortHash(d.paired_receipt, 14)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      </DataGate>
    </>
  );
}
