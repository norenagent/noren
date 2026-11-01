import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { SiteFooter } from "@/app/SiteFooter";
import { SiteHeader } from "@/app/SiteHeader";

const TITLE = "Noren Compute: run agent code in a sandbox, GPU rental coming soon";
const DESCRIPTION =
  "Run Python or a small website inside a gVisor sandbox with no network, tight limits and a hash-chained audit record. Pay-per-second GPU rental on Robinhood Chain is coming soon.";

export const metadata: Metadata = pageMetadata("/compute", { title: "Noren Compute", section: "Compute" }, {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/compute" },
});

const LIMITS: Array<[string, string]> = [
  ["Isolation", "gVisor user-space kernel"],
  ["Network", "None"],
  ["CPU", "1"],
  ["Memory", "128 MB"],
  ["Processes", "32"],
  ["Disk", "8 MB"],
  ["Time", "10 seconds"],
  ["Host files and secrets", "Not visible"],
];

const PLAN: Array<[string, string]> = [
  [
    "Pay for the seconds you use",
    "A session holds its ceiling up front: the rate times the window you ask for. You are charged for the running time and the rest of the deposit comes back when the session closes.",
  ],
  [
    "One settlement on Robinhood Chain",
    "While a session runs, a meter counts GPU time that the renter and the operator can both read. When the session ends, it settles on Robinhood Chain in a single transaction, in USDG.",
  ],
  [
    "Operators stake before they take work",
    "A node locks a stake before it can accept leases, and a proven fault costs part of it. Operators earn for every second their GPU is rented.",
  ],
];

export default function Page() {
  return (
    <main className="min-h-screen bg-ground">
      <SiteHeader />
      <div className="page-container">
        <p className="text-[13px] font-semibold text-muted">Compute</p>
        <h1 className="page-title mt-3 text-fg">Noren Compute</h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-fg-soft">
          Run agent code in an isolated sandbox today. Next comes renting a GPU by the second, paid in USDG on Robinhood Chain:
          you pay for the time you use, and the rest of your deposit comes back when the session closes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="https://sandbox.usenoren.xyz/workspace" className="btn btn-primary" target="_blank" rel="noopener noreferrer">Open the workspace</a>
          <a href="https://docs.usenoren.xyz" className="btn btn-secondary">Read the docs</a>
        </div>

        <figure className="mt-12 max-w-5xl">
          <div className="overflow-hidden rounded-3xl bg-black shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] ring-1 ring-[rgba(245,243,236,0.22)]">
            <video
              className="block aspect-video w-full"
              controls
              playsInline
              preload="metadata"
              poster="/compute/noren-compute-poster.jpg"
            >
              <source src="/compute/noren-compute.mp4" type="video/mp4" />
              Your browser cannot play this video.
            </video>
          </div>
          <figcaption className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-muted">
            <span className="inline-flex rounded-full bg-lime px-3 py-1 font-bold text-forest">Concept film · GPU rental coming soon</span>
            <span>1 min 28 s. The figures in the film illustrate the design; no GPU leases are live yet.</span>
          </figcaption>
        </figure>

        <h2 className="mt-16 text-[20px] font-extrabold text-forest">How GPU rental is designed to work</h2>
        <div className="mt-5 grid max-w-5xl gap-4 sm:grid-cols-3">
          {PLAN.map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-raised p-5 ring-1 ring-line">
              <h3 className="text-[15px] font-extrabold text-forest">{t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 max-w-3xl rounded-3xl bg-raised p-7 shadow-[0_12px_32px_-16px_rgba(31,71,35,0.18)]">
          <span className="inline-flex rounded-full bg-lime px-4 py-1.5 text-[13px] font-bold text-forest">Coming soon on Robinhood Chain</span>
          <p className="mt-5 text-[15px] leading-relaxed text-fg-soft">
            Not live yet: GPU leases, operator staking, the metered escrow, prices and payouts. There are no leases, operators or
            rates to show today, and the escrow contracts are not deployed.
          </p>
          <p className="mt-3 text-[14px] text-muted">
            Also not live: network access for workspaces. It stays off until there is an allowlist, an egress proxy and an approval policy.
          </p>
        </div>

        <h2 className="mt-16 text-[20px] font-extrabold text-forest">Live today: the sandbox</h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-fg-soft">
          A throwaway workspace that runs a small program or builds a small website, then deletes itself. You can use it in the public sandbox right now.
        </p>
        <dl className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-2">
          {LIMITS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-2xl bg-raised px-5 py-4 ring-1 ring-line">
              <dt className="text-[14px] text-muted">{k}</dt>
              <dd className="text-[14px] font-bold text-forest">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-3xl text-[14px] text-muted">
          The browser never chooses the image, command, runtime or limits. The server owns them. After a run only file names and sizes are returned,
          and the audit chain stores hashes of your code and output, not the text.
        </p>

        <h2 className="mt-14 text-[20px] font-extrabold text-forest">What you can run</h2>
        <div className="mt-5 grid max-w-3xl gap-4 sm:grid-cols-3">
          {[
            ["Web starter", "A fixed demo that proves a workspace can write files and be cleaned up."],
            ["Run my Python", "Paste a program. Verified by Turnstile, with a daily quota."],
            ["Ask the agent", "Describe a small program or website. A model writes it and its tests, runs them, reads the failures and fixes itself, up to 4 rounds."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-raised p-5 ring-1 ring-line">
              <h3 className="text-[15px] font-extrabold text-forest">{t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
