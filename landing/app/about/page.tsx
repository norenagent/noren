import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

export const metadata: Metadata = pageMetadata("/about", { title: "About Noren" }, {
  title: "About Noren",
  description:
    "Noren is an open, host-level operating layer for agentic software: every agent runs under a signed grant, every action leaves a receipt, and the audit log can be verified by anyone.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    url: "https://usenoren.xyz/about",
    title: "About Noren: the operating layer for agentic software",
    description:
      "Permission, not trust. A receipt for every decision. Permission, not trust. A receipt for every decision.",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Noren: the operating layer for agentic software",
    description:
      "Permission, not trust. A receipt for every decision. Permission, not trust. A receipt for every decision.",
  },
});

const eyebrow = "font-mono text-[11px] uppercase tracking-[0.3em] text-muted";
const headingTitle = "text-[13px] uppercase tracking-[0.25em] text-fg sm:text-[14px]";
const paragraph = "text-[13px] leading-relaxed text-fg-soft sm:text-[14px]";
const linkClass =
  "underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-fg-soft hover:text-fg";

type Section = { id: string; label: string; title: string; body: React.ReactNode };

const SECTIONS: Section[] = [
  {
    id: "layer",
    label: "01",
    title: "The operating layer, not a wrapper",
    body: (
      <p className={paragraph}>
        Think of an operating system: it sits between your apps and the hardware and decides what
        each one is allowed to do. Noren is that layer for AI agents. It exposes eight
        capabilities through one local service (a daemon) over your machine&apos;s own internal
        channels: intent, runtime, memory, identity, permissions, comms, compositor, and settlement.
        It doesn&apos;t replace your operating system, and it isn&apos;t a website you call out to.
        It&apos;s infrastructure that runs on the machine where the work happens, under your control.
      </p>
    ),
  },
  {
    id: "permission",
    label: "02",
    title: "Permission, not trust",
    body: (
      <p className={paragraph}>
        Most software trusts an agent the moment it starts running. It can quietly reach anything the
        program itself can. Noren flips that. An agent gets no standing access. Every privileged
        action needs a capability: a cryptographically signed permission slip (ed25519) that names
        one specific action, can be narrowed to a scope, expires, and can be revoked. It is checked
        the instant the action is attempted, so an agent can do exactly what you signed for and
        nothing else, and the check runs the same way whether the action succeeds or fails.
      </p>
    ),
  },
  {
    id: "receipt",
    label: "03",
    title: "A receipt for every decision",
    body: (
      <p className={paragraph}>
        Every consequential thing the system does is written down as it happens: who was issued an
        identity, which permissions were checked, what was settled. It all goes into a tamper-evident
        log: append-only and hash-chained, so any later edit breaks the chain and shows. Each entry
        records what kind of event it was, who issued it, and when, and you can verify the whole
        chain yourself, on your own machine. The result is a receipt for every decision the system
        makes, kept no matter the outcome.
      </p>
    ),
  },
  {
    id: "open",
    label: "04",
    title: "Open source, and checkable",
    body: (
      <p className={paragraph}>
        Noren is open source under the Apache License 2.0, and it is built on an existing open-source
        project (see the credits below). You can run the same daemon the sandbox uses, send it a task,
        and verify the hash-chained audit log yourself. Nothing here asks you to trust a claim you cannot check.
      </p>
    ),
  },
  {
    id: "local",
    label: "05",
    title: "Local-first, and yours",
    body: (
      <p className={paragraph}>
        One key, on your hardware, is the root of everything. A single ed25519 keypair per install
        signs your permission grants, signs on-chain settlement, and stamps the audit log. One
        identity ties it all together. Your agents, your memory, and your keys stay on your machine
        by default. The core is open source under the{" "}
        <a
          href="https://www.apache.org/licenses/LICENSE-2.0"
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Apache License 2.0
        </a>
        , and the protocol is public, so how Noren works is never hidden behind a service you
        can&apos;t inspect.
      </p>
    ),
  },
  {
    id: "real",
    label: "06",
    title: "What's real, stated plainly",
    body: (
      <p className={paragraph}>
        We are careful to separate what ships from what is planned. Today the local control plane is
        real and tested: the workspace has 50 Rust crates and about 3,870 tests, 486 of which run
        against a live daemon. Production-grade isolation for untrusted code and networked multi-peer
        operation are on the roadmap, not the changelog; settlement is built for Robinhood Chain (chain 4663, USDG), and its daemon-driven
        per-intent lifecycle is not yet production. An agent&apos;s identity,
        reputation, and bond receipts are published as signed statements any contract can check in
        one step; the parts not exercised yet, like on-chain reputation writes and funded
        bonds, we mark as such. The line between done, experimental, and
        planned is documented in BUILT.md and throughout the docs. If a claim is not true yet, we do
        not make it.
      </p>
    ),
  },
];

const CTA = [
  { label: "Try the sandbox", href: "https://sandbox.usenoren.xyz" },
  { label: "Documentation", href: "https://docs.usenoren.xyz" },
  { label: "Open source credits", href: "#credits" },
];

export default function AboutPage() {
  return (
    <main id="main-content" className="relative min-h-screen overflow-x-hidden bg-ground">
      <SiteHeader />

      <div className="page-container">
        <h1 className="mb-10 text-[11px] uppercase tracking-[0.4em] text-muted sm:mb-14">
          About
        </h1>

        <h2 className="type-display max-w-3xl text-balance text-[2.2rem] text-fg sm:text-[2.6rem]">
          An operating layer that agents can be held to
        </h2>

        <p className="mt-6 max-w-2xl text-pretty text-[15px] leading-[1.7] text-fg-soft sm:text-base">
          AI agents are starting to act on your computer: running code, moving money, touching your
          files. Noren is the layer that lets them do that safely. It gives people and agents a
          small set of host-level controls (intent, runtime, memory, identity, permissions, comms, a
          compositor, and settlement) so they can share one machine without having to trust each
          other. It runs where your work runs, not behind someone else&apos;s API.
        </p>

        <ol className="relative mt-16 sm:mt-24">
          {SECTIONS.map((s, i) => {
            const isLast = i === SECTIONS.length - 1;
            return (
              <li
                key={s.id}
                id={s.id}
                className={`relative border-l border-line/80 pl-8 sm:pl-12 ${isLast ? "" : "pb-14 sm:pb-16"}`}
              >
                <span
                  aria-hidden="true"
                  className="absolute -left-[5px] top-[7px] h-[9px] w-[9px] rounded-full border border-line-strong bg-ground"
                />
                <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className={eyebrow}>{s.label}</span>
                  <h2 className={headingTitle}>{s.title}</h2>
                </div>
                {s.body}
              </li>
            );
          })}
        </ol>

        <div className="mt-16 border-t border-line/80 pt-8 sm:mt-24">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className={eyebrow}>The Noren token</span>
            <h2 className={headingTitle}>The token</h2>
          </div>
          <p className={`max-w-2xl ${paragraph}`}>
            The Noren token is Noren&apos;s token on Robinhood Chain. The contract is deployed; its address and the facts read from it are on the token page.
          </p>
          <p className={`mt-4 max-w-2xl ${paragraph}`}>
            Only the contract exists. Staking, operator requirements and any revenue share are not live, and this site quotes no price.</p>
          <div className="mt-5">
            <a href="/token" className="inline-flex rounded-full bg-lime px-4 py-2 text-[13px] font-semibold text-forest">
              Token contract on Robinhood Chain
            </a>
          </div>
        </div>

        <section id="credits" className="mt-16 border-t border-line/80 pt-8 sm:mt-24">
          <h2 className={headingTitle}>Open source credits</h2>
          <p className={`mt-4 max-w-2xl ${paragraph}`}>
            Noren is built on{" "}
            <a
              href="https://github.com/norenagent/noren"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              Noren
            </a>
            , an open-source project released under the{" "}
            <a
              href="https://www.apache.org/licenses/LICENSE-2.0"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              Apache License 2.0
            </a>
            .
          </p>
        </section>

        <div className="mt-16 flex flex-wrap gap-x-6 gap-y-3 border-t border-line/80 pt-8 sm:mt-24">
          {CTA.map((c) => (
            <a
              key={c.href}
              href={c.href}
              {...(c.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="text-[12px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
            >
              {c.label} →
            </a>
          ))}
        </div>
      </div>

      <SiteFooter className="pb-8" />
    </main>
  );
}
