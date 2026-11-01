import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import Image from "next/image";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { CHAIN, PLANNED, PROTOCOLS, TOOLS, type Integration } from "../_partners";

const DESC =
  "The standards, network, asset and software Noren runs on. Each entry is checked against the running system; planned items are labelled as planned.";

export const metadata: Metadata = pageMetadata("/partners", { title: "Partners" }, {
  title: "Partners & integrations",
  description: DESC,
  alternates: { canonical: "/partners" },
  openGraph: {
    type: "website",
    url: "https://usenoren.xyz/partners",
    title: "Noren partners & integrations",
    description: DESC,
  },
  twitter: { card: "summary_large_image", title: "Noren partners & integrations", description: DESC },
});

const CTA = [
  { label: "Get in touch", href: "/contact", primary: true },
  { label: "Documentation", href: "https://docs.usenoren.xyz" },
];

function StatusBadge({ status }: { status: Integration["status"] }) {
  const live = status === "live";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[12px] font-bold ${
        live ? "bg-ground text-ok" : "bg-lime text-forest"
      }`}
    >
      {live ? "Live" : "Planned"}
    </span>
  );
}

/** A real mark when we have one; otherwise a neutral monogram, never an invented logo. */
function Avatar({ item }: { item: Integration }) {
  const round = "h-10 w-10 shrink-0 rounded-full bg-white object-contain p-1.5 ring-1 ring-forest/10";
  if (item.logo) {
    const isPhoto = item.logo.endsWith(".jpg");
    return (
      <Image
        src={item.logo}
        alt=""
        width={40}
        height={40}
        unoptimized={item.logo.endsWith(".svg")}
        className={isPhoto ? "h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-forest/10" : round}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ground text-[15px] font-extrabold text-forest ring-1 ring-forest/10"
    >
      {item.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Card({ item }: { item: Integration }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-3">
          <Avatar item={item} />
          <span className="text-[17px] font-bold leading-tight tracking-tight text-fg">{item.name}</span>
        </span>
        <StatusBadge status={item.status} />
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">{item.blurb}</p>
      {item.by ? <p className="mt-auto pt-4 text-[13px] text-muted-2">by {item.by}</p> : null}
    </>
  );
  const className =
    "flex h-full min-h-[170px] flex-col rounded-3xl bg-raised p-6 shadow-[0_12px_32px_-16px_rgba(31,71,35,0.18)] transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-16px_rgba(31,71,35,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
  return item.href ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <div className={className}>{inner}</div>
  );
}

function Group({ title, lead, items }: { title: string; lead: string; items: Integration[] }) {
  return (
    <section className="mt-14">
      <h2 className="text-[22px] font-extrabold tracking-tight text-fg">{title}</h2>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">{lead}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.slug} item={item} />
        ))}
      </div>
    </section>
  );
}

export default function PartnersPage() {
  return (
    <main id="main-content" className="relative min-h-screen overflow-x-hidden bg-ground">
      <SiteHeader />
      <div className="page-container">
        <p className="text-[13px] font-semibold text-muted">Partners</p>
        <h1 className="page-title mt-3 text-fg">Built to plug in</h1>
        <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-fg-soft">
          Noren speaks open standards and runs on software you can inspect. This page lists what
          is real in the running system today. A company is not called a partner here unless it
          has agreed to be one, and anything not shipped is labelled planned. Marks belong to their
          owners and are shown only to identify the product.
        </p>

        <Group
          title="Standards"
          lead="Open protocols any compliant client can use. No bespoke integration needed."
          items={PROTOCOLS}
        />
        <Group
          title="Network and asset"
          lead="Where Noren's paid routes settle, and what they are priced in."
          items={CHAIN}
        />
        <Group
          title="What Noren runs on"
          lead="Software in the live path, each one verified against the running system."
          items={TOOLS}
        />
        <Group
          title="Planned"
          lead="Designed but not shipped. Nothing in this group is available today."
          items={PLANNED}
        />

        <section className="mt-14 max-w-2xl rounded-3xl bg-lime p-8">
          <p className="text-[16px] leading-relaxed text-forest">
            Building something on Noren, or want your product to integrate? The protocol surface is
            open and documented. Reach out and we will help you wire it in.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {CTA.map((c) => {
              const external = c.href.startsWith("http");
              return (
                <a
                  key={c.href}
                  href={c.href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="btn btn-secondary"
                >
                  {c.label}
                </a>
              );
            })}
          </div>
        </section>
      </div>
      <SiteFooter className="pb-8" />
    </main>
  );
}
