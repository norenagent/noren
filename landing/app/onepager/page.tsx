import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { NorenMark } from "../_brand";

const DESCRIPTION =
  "Noren: verifiable trust and safe execution for AI agents on Robinhood Chain. One-pager.";

// Unlinked by design — not in any nav/footer, and noindex so it is only reached
// by people given the direct link. Also the print/PDF source: the @media print
// block renders a full-bleed A4 page, on the mint ground like the site.
export const metadata: Metadata = pageMetadata("/onepager", { title: "Noren one-pager" }, {
  title: "Noren — one pager",
  description: DESCRIPTION,
  alternates: { canonical: "/onepager" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    type: "website",
    url: "https://usenoren.xyz/onepager",
    title: "Noren — verifiable trust & safe execution for AI agents on Robinhood Chain",
    description: DESCRIPTION,
  },
});

const CSS = `
@page { size: A4; margin: 0; }
/* Sizes below are the SCREEN sizes (matched to the rest of the site). The @media print block at the bottom compacts
   everything back down so the PDF still fits one A4 page. */
#op {
  --fg: #1f4723; --body: #2f5c34; --muted: #4a6b4e; --faint: #5f7e63; --line: #bfdcc3;
  --ramp: linear-gradient(115deg, #42b34d, #42b34d);
  --mono: var(--font-hanken), system-ui, sans-serif;
  background: #e4f5e6; color: var(--fg); min-height: 100dvh; font-family: var(--font-hanken), system-ui, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
#op .page { max-width: 920px; margin: 0 auto; padding: clamp(32px, 6vw, 72px); background: #e4f5e6; }
#op .mast { display: flex; align-items: center; justify-content: center; gap: 18px; padding-bottom: 12px; }
#op .mark { display: block; width: auto; height: 54px; }
#op .wordmark { margin: 0; font-family: var(--mono); font-weight: 800; font-size: 22px; line-height: 1; letter-spacing: 0; text-transform: none; color: var(--fg); }
#op hr { border: 0; border-top: 1px solid var(--line); margin: 16px 0 20px; }
#op .deck { text-align: center; font-family: var(--mono); font-size: 12px; letter-spacing: 0;  color: var(--body); text-transform: none; margin: 0 0 22px; }
#op .lede { font-size: 15px; line-height: 1.72; color: var(--body); margin: 0 0 30px; }
#op .lede strong { color: var(--fg); font-weight: 600; }
#op .cols { display: flex; gap: 44px; }
#op .col { flex: 1; min-width: 0; }
#op .seclabel { font-family: var(--mono); font-size: 11px; letter-spacing: 0; text-transform: none; color: var(--muted); margin: 0 0 15px; }
#op .seclabel .n { color: var(--faint); margin-right: 10px; }
#op .intro { color: var(--muted); font-size: 14px; line-height: 1.65; margin: 0 0 18px; }
#op .guarantee { border-left: 2px solid transparent; border-image: var(--ramp) 1; padding: 0 0 0 14px; margin: 0 0 17px; }
#op .guarantee p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--muted); }
#op .guarantee b { color: var(--fg); font-weight: 600; }
#op ul.live { list-style: none; margin: 0; padding: 0; }
#op ul.live li { position: relative; padding-left: 18px; margin: 0 0 17px; font-size: 14px; line-height: 1.6; color: var(--muted); }
#op ul.live li::before { content: ""; position: absolute; left: 0; top: 8px; width: 6px; height: 6px; border-radius: 1.5px; background: var(--ramp); }
#op ul.live b { color: var(--fg); font-weight: 600; }
#op .block { margin-top: 30px; }
#op .block p { font-size: 14px; line-height: 1.7; color: var(--muted); margin: 0; }
#op .block p b { color: var(--fg); font-weight: 600; }
#op .block p .lit { color: var(--body); }
#op .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 36px; padding-top: 16px; border-top: 1px solid var(--line); font-family: var(--mono); font-size: 11px; letter-spacing: 0; color: var(--faint); text-transform: none; }
#op .foot .site { color: var(--muted); }
#op .foot .tag { font-family: var(--mono); color: var(--body); margin-right: 6px; }
@media (max-width: 640px) { #op .cols { flex-direction: column; gap: 28px; } }
@media print {
  #op { min-height: 0; background: #e4f5e6; }
  #op .page { width: 210mm; height: 297mm; max-width: none; overflow: hidden; padding: 15mm 16mm 12mm; background: #e4f5e6; }
  #op .mast { gap: 12px; padding-bottom: 9px; }
  #op .mark { height: 34px; }
  #op .wordmark { font-size: 15px; }
  #op hr { margin: 13px 0 16px; }
  #op .deck { font-size: 9.5px; letter-spacing: 0;  margin-bottom: 16px; }
  #op .lede { font-size: 12px; line-height: 1.62; margin-bottom: 22px; }
  #op .cols { flex-direction: row; gap: 34px; }
  #op .seclabel { font-size: 9px; letter-spacing: 0; margin-bottom: 11px; }
  #op .intro { font-size: 11px; line-height: 1.55; margin-bottom: 14px; }
  #op .guarantee { padding-left: 12px; margin-bottom: 13px; }
  #op .guarantee p { font-size: 11px; line-height: 1.55; }
  #op ul.live li { padding-left: 16px; margin-bottom: 13px; font-size: 11px; line-height: 1.55; }
  #op ul.live li::before { top: 5px; }
  #op .block { margin-top: 22px; }
  #op .block p { font-size: 11px; line-height: 1.62; }
  #op .foot { margin-top: 26px; padding-top: 12px; font-size: 9px; }
}
`;

export default function OnePagerPage() {
  return (
    <main id="op">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="page" id="main-content">
        <div className="mast">
          <NorenMark className="mark" />
          <p className="wordmark">Noren</p>
        </div>
        <hr />
        <p className="deck">Verifiable trust &amp; safe execution for AI agents on Robinhood Chain</p>

        <p className="lede">
          Autonomous agents are getting wallets, spend authority, and the ability to act onchain. The barrier is trust:
          no one hands an agent real money if it can overspend, be tricked into a bad signature, or leave no record.{" "}
          <strong>Noren is the layer that bounds what an agent can do and lets anyone verify what it did.</strong>{" "}
          It is being built for Robinhood Chain (chain id 4663), settling in USDG.
        </p>

        <div className="cols">
          <div className="col">
            <p className="seclabel"><span className="n">01</span>What Noren is</p>
            <p className="intro">
              A local daemon, norend, runs agents under controls they cannot bypass. Three guarantees hold on every action:
            </p>
            <div className="guarantee"><p><b>Capability gating.</b> An agent runs only actions covered by a signed capability grant. Anything outside it is refused.</p></div>
            <div className="guarantee"><p><b>Hash-chained audit.</b> Every action is appended to a tamper-evident log, and a signed receipt fails verification if any field changes.</p></div>
            <div className="guarantee"><p><b>Bounded spend.</b> Payments are capped before they happen: x402 pay-per-call settling in USDG via EIP-3009, and an escrow that cannot release more than the grant.</p></div>
          </div>

          <div className="col">
            <p className="seclabel"><span className="n">02</span>Status</p>
            <ul className="live">
              <li><b>Runs today.</b> The daemon, signed capability grants and the audit log run in the public sandbox at sandbox.usenoren.xyz.</li>
              <li><b>Written, not yet deployed.</b> The Solidity contracts in the repo: bond receipt verifier, reputation registry, spend-grant escrow, RWA trade guard and guarded trade executor.</li>
              <li><b>Coming soon on Robinhood Chain.</b> Noren's own contract addresses, staking and Compute. The Noren token contract is deployed; none of these quote a price or a balance.</li>
            </ul>
          </div>
        </div>

        <div className="block">
          <p className="seclabel"><span className="n">03</span>Open standards</p>
          <p>
            Noren speaks <span className="lit">MCP</span> for tools, <span className="lit">A2A</span> for agent-to-agent
            tasks and <span className="lit">x402</span> for pay-per-call HTTP. It lists no third-party partners
            until an integration ships on Robinhood Chain.
          </p>
        </div>

        <div className="block">
          <p className="seclabel"><span className="n">04</span>Business model</p>
          <p>
            <span className="lit">Noren is infrastructure others build on.</span>{" "}The plan is a small fee on governed
            actions and a premium tier for verifiable receipts, with teams licensing the trust layer directly. The
            any revenue share is not defined and not live today.
          </p>
        </div>

        <div className="foot">
          <span className="site"><span className="tag">{"</>"}</span>usenoren.xyz</span>
        </div>
      </div>
    </main>
  );
}
