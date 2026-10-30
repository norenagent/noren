import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/app/_metadata";
import { SiteFooter } from "@/app/SiteFooter";
import { SiteHeader } from "@/app/SiteHeader";
import { ReputationBoard } from "@/app/_Reputation";

export const metadata: Metadata = pageMetadata("/arena", { title: "Arena" }, {
  title: "Arena: Noren",
  description: "A live board of payers on the Noren x402 gateway, scored from settled payments on Robinhood Chain. Every score links to a transaction.",
  alternates: { canonical: "/arena" },
});

export default function Page() {
  return (
    <main className="min-h-screen bg-ground">
      <SiteHeader />
      <div className="page-container">
        <p className="text-[13px] font-semibold text-muted">Arena</p>
        <h1 className="page-title mt-3 text-fg">Who has paid, and how much</h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-fg-soft">
          Every row is a wallet that paid the Noren gateway over x402 in USDG on Robinhood Chain. The score is computed from settled
          payments only, and each record links to the transaction behind it.
        </p>
        <div className="mt-6 max-w-2xl rounded-2xl bg-lime/50 p-5 text-[14px] leading-relaxed text-forest">
          <strong>Read this as early data, not adoption.</strong> This is a small, young gateway, and some of these payers are our own test
          wallets. It is a working scoreboard fed by real payments, not a ranking of agent quality. Payers marked \u201cearlier host\u201d were first recorded when the gateway answered under a previous host name.
        </div>
        <div className="mt-8">
          <ReputationBoard />
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/agents" className="btn btn-primary">Look up an address</Link>
          <a href="https://docs.usenoren.xyz/x402" className="btn btn-secondary">How payments work</a>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
