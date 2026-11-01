import { FooterCA } from "./FooterCA";
import type { CSSProperties } from "react";
import Link from "next/link";
import { HeaderStats } from "./HeaderStats";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { SiteMotion } from "./SiteMotion";
import { DOCS_URL, SANDBOX_URL } from "./_brand";
import { PRIMITIVES } from "./_primitives";

const shell = "mx-auto w-full max-w-7xl px-5 sm:px-8";
const h2 = "type-display text-[clamp(1.7rem,3.4vw,2.6rem)] text-forest";
const sectionPad = "py-[clamp(48px,6vw,88px)]";

const legacyHost = (href: string) =>
  href
    .replace("https://docs.usenoren.xyz", DOCS_URL)
    .replace("https://usenoren.xyz", "https://usenoren.xyz");

const STEPS = [
  {
    n: "1",
    title: "Grant",
    body: "You issue a signed capability that names exactly what an agent may do, for how long, and within what limits.",
    href: "https://docs.usenoren.xyz/capabilities",
    tone: "bg-white",
  },
  {
    n: "2",
    title: "Act",
    body: "The agent runs under that grant. Anything outside it is refused before it happens, not logged after.",
    href: "https://docs.usenoren.xyz/primitives",
    tone: "bg-lime",
  },
  {
    n: "3",
    title: "Prove",
    body: "Every action leaves a receipt in a hash-chained audit log, so anyone can check what was done and under whose authority.",
    href: "https://docs.usenoren.xyz/audit",
    tone: "bg-mint",
  },
];

const PRODUCTS = [
  {
    name: "Guard",
    href: "/guard",
    tag: "Trust layer",
    body: "Before your agent pays or trusts another agent, it will check an on-chain track record, confirm a real identity, and verify a signed claim once the Robinhood Chain contracts are live. A zero-install MCP for Claude and Codex.",
    cta: "Explore Guard",
    tone: "bg-white",
  },
  {
    name: "Trading",
    href: "/trading",
    tag: "Governed execution",
    body: "Brokerages are opening to agents with no real limits. Noren is the policy gate in front of the order: caps enforced before it's placed, and every decision signed and, once the contracts are live, anchored on Robinhood Chain where anyone can check it.",
    cta: "See governed trading",
    tone: "bg-lime",
  },
];

function ArrowButton({ light = false }: { light?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] transition-transform duration-150 group-hover:translate-x-0.5 ${
        light ? "bg-white text-forest" : "bg-forest text-lime"
      }`}
    >
      →
    </span>
  );
}

export default function Page() {
  return (
    <main id="main-content" className="glass-home relative min-h-screen overflow-x-clip">
      <div className="sr-only">
        <p>
          Noren is the open, local-first operating layer for agentic software. It gives humans
          and agents eight host-level primitives (intent, runtime, memory, identity, permissions,
          communication, a compositor, and on-chain settlement) so they can safely share one
          computer. Try the <a href={SANDBOX_URL}>interactive sandbox</a>, read the{" "}
          <a href={`${DOCS_URL}/concepts`}>documentation on the eight primitives</a>, or review the{" "}
          <Link href="/roadmap">development roadmap</Link>.
        </p>
      </div>

      <SiteMotion />
      <SiteHeader />

      {/* Hero: the footage sits fixed behind the whole page; everything else is glass. */}
      <section className="hero-block hero-video" aria-labelledby="hero-title">
        <div className={`${shell} flex min-h-[100svh] flex-col items-center justify-center gap-7 pb-24 pt-[calc(var(--header-h)+24px)] text-center`}>
          <h1 id="hero-title" className="hero-display">
            An operating layer that agents can be held to.
          </h1>
          <p className="hero-sub">
            Every agent runs under a signed grant. Every action leaves a receipt in a hash-chained
            audit log. Eight primitives, built in the open.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={SANDBOX_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Try the interactive Noren sandbox"
              className="btn btn-primary"
            >
              Try the sandbox <span aria-hidden="true">→</span>
            </a>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Read the docs
            </a>
          </div>
          <div className="hero-ca">
            <span className="hero-ca-label">CA</span>
            <FooterCA tone="light" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={sectionPad} aria-labelledby="how-title">
        <div className={shell}>
          <h2 id="how-title" className={h2}>
            How Noren works
          </h2>
          <p className="mt-3 max-w-xl text-[17px] text-fg-soft">Permission, not trust. Three steps, every time.</p>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="reveal">
                <a
                  href={s.href}
                  className={`card card-link group relative flex min-h-[260px] h-full flex-col justify-between p-7 ${s.tone}`}
                  style={s.tone === "bg-white" ? undefined : { background: s.tone === "bg-lime" ? "#e2f3e4" : "#d6eed9" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-forest">{s.n}</span>
                    <ArrowButton />
                  </div>
                  <div>
                    <h3 className="type-display text-[1.9rem] text-forest">{s.title}</h3>
                    <p className="mt-3 text-[15px] leading-[1.55] text-fg-soft">{s.body}</p>
                    <span className="mt-5 block text-[13px] font-bold text-forest">Read the primitive <span aria-hidden="true">→</span></span>
                  </div>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Eight primitives */}
      <section className={sectionPad} aria-labelledby="primitives-title">
        <div className={shell}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] md:items-end md:gap-14">
            <h2 id="primitives-title" className={h2}>
              One computer, safely shared by humans and agents
            </h2>
            <p className="max-w-md text-[16px] leading-[1.55] text-fg-soft">
              Eight host-level primitives: intent, runtime, memory, identity, permissions,
              communication, a compositor, and on-chain settlement.
            </p>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRIMITIVES.slice(0, 8).map((p, i) => (
              <li key={p.slug} className="reveal">
                <a
                  href={legacyHost(p.docHref)}
                  className="card group flex h-full flex-col gap-3 p-6 transition-transform duration-200 hover:-translate-y-1"
                >
                  <span className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime font-mono text-[12px] font-semibold tabular-nums text-forest">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <ArrowButton />
                  </span>
                  <span className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-forest">{p.term}</span>
                  <span className="text-[14px] leading-[1.55] text-muted">{p.gloss}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Products */}
      <section className={sectionPad} aria-labelledby="products-title">
        <div className={shell}>
          <h2 id="products-title" className={h2}>
            Two ways agents meet the real world
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {PRODUCTS.map((prod) => (
              <article
                key={prod.href}
                className="reveal card flex flex-col p-8"
                style={prod.tone === "bg-lime" ? { background: "#e2f3e4" } : undefined}
              >
                <span className="text-[13px] font-semibold text-muted">{prod.tag}</span>
                <h3 className="type-display mt-2 text-[2.6rem] text-forest">{prod.name}</h3>
                <p className="mt-4 max-w-lg text-[15px] leading-[1.6] text-fg-soft">{prod.body}</p>
                <Link href={prod.href} className="group mt-8 inline-flex items-center gap-3 text-[15px] font-bold text-forest">
                  {prod.cta}
                  <ArrowButton />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Built in the open */}
      <section className={sectionPad} aria-labelledby="builds-title">
        <div className={shell}>
          <div className="glass rounded-[22px] p-7 sm:p-12">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-end md:gap-14">
              <h2 id="builds-title" className={h2}>
                Built to be <span className="text-ramp">checked</span>
              </h2>
              <div>
                <p className="text-[16px] leading-[1.6] text-fg-soft">
                  Every agent action runs under a signed grant, is checked before it goes through, and leaves a receipt in a hash-chained audit log. You can run the same daemon the sandbox uses and verify the chain yourself.</p>
                <a href="https://sandbox.usenoren.xyz" className="btn btn-primary mt-6">
                  Try the sandbox <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
            <div className="mt-10">
              <HeaderStats />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-[clamp(48px,6vw,88px)]" aria-labelledby="cta-title">
        <div className={shell}>
          <div
            className="reveal glass flex flex-col items-start gap-8 rounded-[22px] p-8 sm:p-14 md:flex-row md:items-center md:justify-between"
          >
            <h2 id="cta-title" className="type-display text-[clamp(1.9rem,4vw,3rem)] text-forest">
              Try the sandbox
            </h2>
            <div className="flex shrink-0 flex-wrap gap-3">
              <a
                href={SANDBOX_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Try the sandbox <span aria-hidden="true">→</span>
              </a>
              <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                Read the docs
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
