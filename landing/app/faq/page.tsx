import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const DESCRIPTION =
  "Answers to common questions about Noren: what it is, how it relates to MCP, whether it needs a blockchain, the eight primitives, and its pre-1.0 status.";

export const metadata: Metadata = pageMetadata("/faq", { title: "FAQ" }, {
  title: "FAQ: Noren",
  description: DESCRIPTION,
  alternates: { canonical: "/faq" },
  openGraph: {
    type: "website",
    url: "https://usenoren.xyz/faq",
    title: "Frequently asked questions about Noren",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Frequently asked questions about Noren",
    description: DESCRIPTION,
  },
});

// One source of truth: drives the visible Q&A and the FAQPage JSON-LD so the
// markup text always matches what a reader sees. Answers are self-contained
// (no pronoun antecedents) so answer engines can quote them verbatim.
const FAQ: { id: string; q: string; a: string }[] = [
  {
    id: "what-is-noren",
    q: "What is Noren?",
    a: "Noren is an open, local-first operating layer that lets people and software agents safely share one computer. It runs as a local daemon and exposes eight host-level primitives: intent, runtime, memory, identity, permissions, comms, a compositor, and settlement.",
  },
  {
    id: "open-source",
    q: "Is Noren open source?",
    a: "Yes. The core is licensed under the Apache License 2.0 and the source repository is coming soon. It is pre-1.0 software.",
  },
  {
    id: "vs-mcp",
    q: "How is Noren different from MCP?",
    a: "MCP is a protocol for connecting a model to tools. Noren is the host-level layer underneath: it provides identity, signed permissions, shared memory, audit, and settlement across agents, and integrates MCP as one of its comms adapters.",
  },
  {
    id: "blockchain",
    q: "Does Noren require a blockchain?",
    a: "No. Noren runs fully locally and records receipts to a local hash-chained audit log by default. Anchoring on Robinhood Chain is planned and not live yet; the Solidity contracts are written in the repository but not deployed.",
  },
  {
    id: "multi-chain",
    q: "Does Noren work across chains?",
    a: "Noren targets Robinhood Chain (chain id 4663), with USDG as the settlement asset and ETH for gas. Other chains are not supported today. Nothing is deployed under the Noren brand yet; the contracts (bond receipt verifier, reputation registry, bounded-spend escrow, trade guard) are written and tested in the repository, and addresses will be published when they go live.",
  },
  {
    id: "eight-primitives",
    q: "What are the eight primitives?",
    a: "Intent, runtime, memory, identity, permissions, comms, compositor, and settlement. Each one is a host-level service that agents and people share, defined term by term in the glossary.",
  },
  {
    id: "production-ready",
    q: "Is Noren production-ready?",
    a: "Not yet. Noren is pre-1.0. The local control plane, including the daemon, CLI, identity, permissions, memory, and audit log, is implemented and runs in the public sandbox. Onchain settlement on Robinhood Chain is coming soon. Production-grade isolation and networked multi-host operation remain on the roadmap, not the changelog.",
  },
  {
    id: "staking",
    q: "What does staking the Noren token do?",
    a: "Staking is coming soon on Robinhood Chain and is not live. The plan is to lock the Noren token for a share of protocol revenue paid in USDG. Nothing is deployed, and any distribution would reflect actual protocol revenue and not be guaranteed.",
  },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://usenoren.xyz/faq#faq",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const paragraph = "text-[13px] leading-relaxed text-fg-soft sm:text-[14px]";
const linkClass =
  "text-[12px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg";

const LINKS = [
  { label: "Glossary", href: "https://docs.usenoren.xyz/glossary" },
  { label: "Documentation", href: "https://docs.usenoren.xyz" },
  { label: "Roadmap", href: "/roadmap" },
];

export default function FaqPage() {
  return (
    <main id="main-content" className="relative min-h-screen overflow-x-hidden bg-ground">
      <SiteHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />

      <div className="page-container">
        <h1 className="mb-10 text-[11px] uppercase tracking-[0.4em] text-muted sm:mb-14">
          FAQ
        </h1>

        <h2 className="type-display max-w-3xl text-balance text-[2.2rem] text-fg sm:text-[2.6rem]">
          Frequently asked questions
        </h2>

        <dl className="mt-14 sm:mt-20">
          {FAQ.map((f, i) => (
            <div
              key={f.id}
              id={f.id}
              className={`border-line/80 py-7 ${i === 0 ? "border-t-0" : "border-t"}`}
            >
              <dt className="max-w-2xl text-[15px] leading-snug text-fg sm:text-[16px]">
                {f.q}
              </dt>
              <dd className={`mt-3 max-w-2xl ${paragraph}`}>{f.a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-line/80 pt-8 sm:mt-16">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className={linkClass}
            >
              {l.label} →
            </a>
          ))}
        </div>
      </div>

      <SiteFooter className="pb-8" />
    </main>
  );
}
