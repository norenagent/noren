import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { SiteFooter } from "../SiteFooter";
import { NorenMark } from "../_brand";

const DESCRIPTION =
  "Every important Noren link in one place: sandbox, docs, the Noren token, staking, and where to reach us.";

export const metadata: Metadata = pageMetadata("/links", { title: "Links" }, {
  title: "Links: Noren",
  description: DESCRIPTION,
  alternates: { canonical: "/links" },
  openGraph: {
    type: "website",
    url: "https://usenoren.xyz/links",
    title: "Noren — all links",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Noren — all links",
    description: DESCRIPTION,
  },
});

type LinkItem = { label: string; href: string; note?: string };

const PRIMARY: LinkItem[] = [
  { label: "Try the sandbox", href: "https://sandbox.usenoren.xyz", note: "Live operator console, no install" },
  { label: "Read the docs", href: "https://docs.usenoren.xyz", note: "Concepts, primitives, API" },
];

const GROUPS: { title: string; items: LinkItem[] }[] = [
  {
    title: "Learn",
    items: [
      { label: "Roadmap", href: "/roadmap" },
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Connect",
    items: [
      { label: "Partners", href: "/partners" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "The Noren token",
    items: [
      { label: "The Noren token", href: "/token", note: "Contract address and what the contract does" },
      { label: "Stake the Noren token", href: "/stake", note: "Not live. Design not final." },
      { label: "Treasury", href: "/treasury", note: "Read-only on-chain metrics" },
    ],
  },
];

function isExternal(href: string) {
  return href.startsWith("http");
}

function LinkButton({ item, primary = false }: { item: LinkItem; primary?: boolean }) {
  const external = isExternal(item.href);
  return (
    <a
      href={item.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`group flex items-center justify-between gap-4 rounded-lg border px-5 transition-colors ${
        primary
          ? "border-line-strong bg-raised py-4 hover:border-muted-2 hover:bg-raised"
          : "border-line/80 bg-raised/60 py-3.5 hover:border-line-strong hover:bg-raised"
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] tracking-wide text-fg">
          {item.label}
        </span>
        {item.note ? (
          <span className="mt-0.5 truncate text-[11px] text-muted-2">{item.note}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-faint transition-colors group-hover:text-fg-soft">
        →
      </span>
    </a>
  );
}

export default function LinksPage() {
  return (
    <main id="main-content" className="relative min-h-screen overflow-x-hidden bg-ground">
      <div className="page-container" style={{ paddingTop: "calc(3.5rem + env(safe-area-inset-top))" }}>
        <div className="mx-auto flex w-full max-w-md flex-col items-center">
          <h1 className="flex flex-col items-center gap-5 text-fg">
            <NorenMark className="h-16 w-auto" />
            <span className="font-mono text-[15px] font-medium leading-none tracking-[0.32em]">Noren</span>
          </h1>

          <div className="mt-10 flex w-full flex-col gap-2.5">
            {PRIMARY.map((item) => (
              <LinkButton key={item.href} item={item} primary />
            ))}
          </div>

          {GROUPS.map((group) => (
            <div key={group.title} className="mt-9 w-full">
              <h2 className="mb-3 text-[10px] uppercase tracking-[0.4em] text-muted-2">
                {group.title}
              </h2>
              <div className="flex w-full flex-col gap-2.5">
                {group.items.map((item) => (
                  <LinkButton key={item.href + item.label} item={item} />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-9 w-full">
            <h2 className="mb-3 font-mono text-[11px] text-muted-2">The Noren token</h2>
            <span className="inline-flex rounded-full bg-lime px-4 py-2 text-[13px] font-semibold text-forest">
              Coming soon on Robinhood Chain
            </span>
          </div>
        </div>
      </div>

      <SiteFooter className="pb-8" />
    </main>
  );
}
