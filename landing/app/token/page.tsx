import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { CopyAddress } from "../CopyAddress";
import { NOREN_TOKEN } from "../_brand";

export const metadata: Metadata = pageMetadata("/token", { title: "The Noren token" }, {
  title: "The Noren token: Noren",
  description: "The Noren token contract on Robinhood Chain (chain 4663): address, supply and what the contract does, read from the chain.",
  alternates: { canonical: "/token" },
});

const FACTS: Array<[string, string]> = [
  ["Name", NOREN_TOKEN.name],
  ["Symbol", NOREN_TOKEN.symbol],
  ["Network", "Robinhood Chain, chain id 4663"],
  ["Decimals", String(NOREN_TOKEN.decimals)],
  ["Total supply", NOREN_TOKEN.totalSupply],
];

export default function Page() {
  return (
    <main className="min-h-screen bg-ground">
      <SiteHeader />
      <div className="page-container">
        <p className="text-[13px] font-semibold text-muted">The token</p>
        <h1 className="page-title mt-3 text-fg">The Noren token</h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-fg-soft">
          The Noren token is deployed on Robinhood Chain. This is its contract address. Check it against the explorer before you do anything
          with it, and treat any other address, ticker or link that claims to be Noren as not ours.
        </p>

        <div className="mt-8 max-w-3xl rounded-3xl bg-raised p-7 shadow-[0_12px_32px_-16px_rgba(31,71,35,0.18)]">
          <span className="inline-flex rounded-full bg-lime px-4 py-1.5 text-[13px] font-bold text-forest">Contract address</span>
          <div className="mt-5"><CopyAddress address={NOREN_TOKEN.address} label="Copy the Noren token contract address" /></div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={NOREN_TOKEN.explorer} target="_blank" rel="noopener noreferrer" className="btn btn-primary">View on explorer</a>
          </div>
        </div>

        <h2 className="mt-12 text-[20px] font-extrabold text-forest">Read from the contract</h2>
        <dl className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-2">
          {FACTS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 ring-1 ring-forest/10">
              <dt className="text-[14px] text-muted">{k}</dt>
              <dd className="text-[14px] font-bold text-forest">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-3xl text-[14px] text-muted">
          Reading the deployed bytecode: the standard ERC-20 functions plus burn and burnFrom. We looked for mint, pause, blacklist, tax, owner and upgrade functions and found none,
          the code has no selfdestruct or delegatecall, and it is not behind a proxy. That is a read of the bytecode, not an audit, and nothing here is a claim about price.
        </p>

        <h2 className="mt-12 text-[20px] font-extrabold text-forest">Where it is used</h2>
        <div className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-2">
          {[
            ["On the chain", "A standard token on Robinhood Chain. Anyone can hold, send and burn it."],
            ["On this site", "Nothing requires it. Sandbox, workspace, agent and the x402 gateway work without holding it."],
            ["Staking", "No staking contract exists. The design is not final."],
            ["Fees and revenue", "No fee share is defined or paid."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-white p-5 ring-1 ring-forest/10">
              <h3 className="text-[14px] font-extrabold text-forest">{t}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-3xl text-[12.5px] leading-relaxed text-muted">
          This page is information, not investment advice. Tokens can lose all their value. Noren does not endorse any exchange, pool or price listing.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
