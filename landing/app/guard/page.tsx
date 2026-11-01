import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/app/_metadata";
import { SiteFooter } from "@/app/SiteFooter";
import { SiteHeader } from "@/app/SiteHeader";
import { ReputationLookup } from "@/app/_Reputation";

const TITLE = "Noren Guard: check before your agent pays";
const DESCRIPTION =
  "Read a payer's track record from the Noren gateway before your agent pays or delegates. Also available as a hosted MCP tool.";

export const metadata: Metadata = pageMetadata("/guard", { title: "Noren Guard" }, {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guard" },
});

export default function Page() {
  return (
    <main className="min-h-screen bg-ground">
      <SiteHeader />
      <div className="page-container">
        <p className="text-[13px] font-semibold text-muted">Noren Guard</p>
        <h1 className="page-title mt-3 text-fg">Check before your agent pays</h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-fg-soft">
          Guard is the read-only trust check in front of a payment. It works today as a plain HTTP read and as an MCP tool: add{" "}
          <code>https://mcp.usenoren.xyz/mcp</code> to Claude, Cursor or Codex and call <code>noren_reputation</code>.
        </p>
        <h2 className="mt-10 text-[18px] font-extrabold text-forest">Try it now</h2>
        <div className="mt-4 max-w-2xl"><ReputationLookup /></div>
        <h2 className="mt-12 text-[18px] font-extrabold text-forest">The same call, from code</h2>
        <pre className="mt-4 max-w-2xl overflow-x-auto rounded-2xl bg-forest-deep p-5 text-[13px] leading-relaxed text-[#c4edc9]"><code>{`curl "https://gateway.usenoren.xyz/reputation?address=0x…"

# response.queried -> { address, score, tier, settledCount,
#                       totalUsdg, firstSeen, lastSeen, txHashes }`}</code></pre>
        <div className="mt-10 max-w-2xl rounded-3xl bg-raised p-7 shadow-[0_12px_32px_-16px_rgba(31,71,35,0.18)]">
          <span className="inline-flex rounded-full bg-lime px-4 py-1.5 text-[13px] font-bold text-forest">Still planned</span>
          <ul className="mt-5 space-y-3 text-[15px] text-muted">
            <li>Identity and bonded-receipt checks against an on-chain verifier, once it is deployed on Robinhood Chain.</li>
            <li>Signed claims checked with ed25519 over a canonical hash.</li>
          </ul>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
