import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/app/_metadata";
import { SiteFooter } from "@/app/SiteFooter";
import { SiteHeader } from "@/app/SiteHeader";
import { ReputationLookup } from "@/app/_Reputation";

export const metadata: Metadata = pageMetadata("/agents", { title: "Proof of agent" }, {
  title: "Proof of agent: Noren",
  description: "Look up what the Noren gateway has seen a wallet pay on Robinhood Chain. Identity passports and attestations are still coming.",
  alternates: { canonical: "/agents" },
});

export default function Page() {
  return (
    <main className="min-h-screen bg-ground">
      <SiteHeader />
      <div className="page-container">
        <p className="text-[13px] font-semibold text-muted">Proof of agent</p>
        <h1 className="page-title mt-3 text-fg">Check a wallet before you trust it</h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-fg-soft">
          Paste a wallet address. You get what this gateway has actually seen it pay: a score, how many payments settled, how much USDG,
          and the transaction to verify it yourself.
        </p>
        <div className="mt-8 max-w-2xl"><ReputationLookup /></div>
        <div className="mt-12 max-w-2xl rounded-3xl bg-raised p-7 shadow-[0_12px_32px_-16px_rgba(31,71,35,0.18)]">
          <span className="inline-flex rounded-full bg-lime px-4 py-1.5 text-[13px] font-bold text-forest">Not live yet</span>
          <ul className="mt-5 space-y-3 text-[15px] text-muted">
            <li>Agent passports: a registered, attested identity for an agent. Needs the Robinhood Chain contracts, which are not deployed.</li>
            <li>Signed attestations you can verify in the browser.</li>
          </ul>
          <p className="mt-5 text-[14px] text-muted">
            A lookup only covers payments to this gateway. A low or unknown score means &ldquo;not seen here&rdquo;, not &ldquo;untrustworthy&rdquo;.
          </p>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
