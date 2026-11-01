import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const TITLE = "Governed agentic trading";
const DESCRIPTION =
  "Brokerages are opening to AI agents with no real limits. Noren is the policy gate in front of the order: caps enforced before anything is placed, every decision signed and, once the contracts are live, anchored on Robinhood Chain.";

export const metadata: Metadata = pageMetadata("/trading", { title: "Governed agentic trading" }, {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/trading" },
  openGraph: {
    type: "website",
    url: "https://usenoren.xyz/trading",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
});

const eyebrow = "text-[13px] font-semibold text-muted";
const paragraph = "text-[13px] leading-relaxed text-fg-soft sm:text-[14px]";
const cmdBlock =
  "block overflow-x-auto whitespace-pre rounded-2xl bg-raised px-5 py-4 font-mono text-[12.5px] leading-relaxed text-fg sm:text-[13px]";
const link =
  "underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-fg-soft";

export default function TradingPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-5 pb-24 pt-[88px] sm:px-8 sm:pt-[120px]">
        <p className={eyebrow}>policy · receipts · track record</p>
        <h1 className="page-title mt-4 text-fg">
          Governed agentic trading
        </h1>
        <p className={`${paragraph} mt-5 max-w-2xl`}>
          Brokerages are opening to AI agents. Robinhood now lets any MCP agent read a portfolio and
          place real orders, and its safety model is a funded sub-account, a notification feed, and a
          disconnect button. There is no per-trade cap, no symbol allowlist, no daily-loss stop, and
          no audit a third party can check. The only limit on a looping agent is the account balance.
        </p>
        <p className={`${paragraph} mt-4 max-w-2xl`}>
          Noren is the layer that governs the order before it leaves. A policy the operator writes
          is enforced ahead of the venue, every decision, placed or refused, becomes a signed receipt
          (to be anchored on Robinhood Chain once the contracts are live), and the receipt history compounds into a track record an agent can prove
          to anyone.
        </p>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "The policy",
              body: "Per-order and daily caps, an allow/deny universe, permitted sides and order types, rate limits, a daily-loss stop, and a human-approval threshold. Enforced before the order is sent, not observed after.",
            },
            {
              title: "The receipt",
              body: "Every decision is signed ed25519 over a canonical hash, refusals included, with onchain anchoring on Robinhood Chain coming soon. Change one field and verification fails. An activity feed inside a broker app can't do that.",
            },
            {
              title: "The record",
              body: "Receipts roll up into mandate adherence and activity: how often the gate had to refuse the agent, and what it actually did. A track record that travels between venues and can't be self-asserted.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-3xl bg-raised p-6 shadow-[0_12px_32px_-16px_rgba(31,71,35,0.18)]">
              <h2 className="text-[18px] font-extrabold tracking-tight text-fg">{c.title}</h2>
              <p className={`${paragraph} mt-3 text-muted`}>{c.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-12">
          <p className={eyebrow}>The policy an operator writes</p>
          <code className={`${cmdBlock} mt-3`}>
            {`{
  "venue": "robinhood-crypto",
  "mode": "dry_run",
  "caps": { "per_order_usd": 500, "daily_notional_usd": 2000 },
  "risk": { "daily_loss_stop_usd": 300 },
  "universe": { "allow": ["BTC-USD", "ETH-USD"], "sides": ["buy"] },
  "order_types": ["market"],
  "rate": { "max_orders_per_min": 10 },
  "approvals": { "require_human_over_usd": 400 }
}`}
          </code>
        </section>

        <section className="mt-12 max-w-2xl rounded-3xl bg-lime p-8">
          <span className="inline-flex items-center rounded-full bg-raised px-4 py-1.5 text-[13px] font-bold text-forest">
            Coming soon on Robinhood Chain
          </span>
          <h2 className="mt-5 text-[22px] font-extrabold tracking-tight text-forest">
            Decisions anchored onchain
          </h2>
          <p className={`${paragraph} mt-3 text-forest`}>
            When the Noren contracts go live on Robinhood Chain (chain id 4663), each decision,
            placed or refused, will be anchored there so anyone can verify it. Nothing is anchored
            yet, so this page shows no transactions and no track record. The policy gate itself
            works today in dry run, as shown below.
          </p>
          <ul className="mt-4 space-y-2 text-[14px] text-forest">
            <li>An order that breaks a cap is refused before it leaves.</li>
            <li>A symbol outside the allow list is refused.</li>
            <li>An order over the approval line waits for a human.</li>
          </ul>
        </section>

        <section className="mt-12">
          <p className={eyebrow}>What the gate decided · real output</p>
          <p className={`${paragraph} mt-3 max-w-2xl`}>
            This is the unedited output of the demo below, run against a mock broker with no credentials. Four orders went to the gate. One was
            allowed to proceed (as a dry run, nothing was sent) and three were refused, each with the reason and a receipt whose signature verified.
          </p>
          <div className="mt-4 max-w-3xl overflow-hidden rounded-2xl bg-white ring-1 ring-forest/10">
            {[
              ["within policy (~$60)", "Executed", "dry run: not sent", true],
              ["over per-order (~$1200)", "Blocked", "per-order cap exceeded (1200.00 > 500.00)", false],
              ["not in universe (DOGE)", "Blocked", "symbol DOGE-USD is not on the allow list", false],
              ["needs approval (~$450)", "Blocked", "approval required and not granted", false],
            ].map(([order, outcome, why, ok], i) => (
              <div key={String(order)} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 ${i ? "border-t border-forest/10" : ""}`}>
                <span className="min-w-[190px] text-[14px] font-semibold text-forest">{order}</span>
                <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${ok ? "bg-lime text-forest" : "bg-[#f6e3de] text-[#7a2a18]"}`}>{outcome}</span>
                <span className="flex-1 text-[13.5px] text-muted">{why}</span>
                <span className="text-[12px] font-semibold text-muted">signature verified</span>
              </div>
            ))}
          </div>
          <p className={`${paragraph} mt-3 max-w-2xl text-muted-2`}>
            No order was placed and no account was touched. The gate is real code with real tests, and this run is a mock, not a live venue.
          </p>
        </section>

        <section className="mt-12">
          <p className={eyebrow}>Run it · no keys, no account</p>
          <p className={`${paragraph} mt-3 max-w-2xl`}>
            The whole gate runs locally in dry-run with zero credentials, from the source tree (source repository: coming soon):
          </p>
          <code className={`${cmdBlock} mt-3`}>
            {`cd agent-os
cargo run -p noren-robinhood --example governed_demo`}
          </code>
          <p className={`${paragraph} mt-2 text-muted-2`}>
            Live execution attaches your own API key on your own account, held in a signing sidecar
            the daemon never reads. Noren is infrastructure you run, not a broker, adviser, or
            custodian, and it never holds funds.
          </p>
        </section>

        <section className="mt-12">
          <p className={eyebrow}>US beta testers wanted</p>
          <p className={`${paragraph} mt-3 max-w-2xl`}>
            We&apos;re extending the same gate to Robinhood&apos;s hosted agentic MCP, and that beta is
            US-only. If you&apos;re trading with an agent on it, we&apos;re looking for five testers to
            run the proxy and help pin down the connect flow. Write{" "}
            <a className={link} href="/contact">
              the contact form
            </a>{" "}.
          </p>
        </section>

        <p className={`${paragraph} mt-14 text-[11.5px] text-faint`}>
          Noren is not affiliated with, endorsed by, or sponsored by Robinhood Markets, Inc.
          Nothing here is investment advice. Agentic trading involves significant risk.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
