import type { Metadata } from "next";
import { CARD_SIZE, cardAlt, cardImageUrl } from "../_metadata";
import { DOCS_URL, SANDBOX_URL, SITE_URL } from "../_brand";
import { Pager } from "./Pager";
import { Sidebar } from "./Sidebar";
import "./docs.css";

export const metadata: Metadata = {
  metadataBase: new URL(DOCS_URL),
  title: {
    default: "Documentation: Noren",
    template: "%s: Noren docs",
  },
  description:
    "Reference, concepts, and operational guides for Noren, the open, agent-native operating layer.",
  // No canonical here: each docs page declares its own absolute canonical via buildDocsMetadata.
  openGraph: {
    type: "website",
    siteName: "Noren docs",
    locale: "en_US",
    images: [{ url: cardImageUrl("/docs"), ...CARD_SIZE, alt: cardAlt("Documentation") }],
  },
  twitter: {
    card: "summary_large_image",
    images: cardImageUrl("/docs"),
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="docs-root min-h-[100dvh]">
      <Sidebar webUrl={SITE_URL} sandboxUrl={SANDBOX_URL} />
      <div className="mx-auto flex w-full max-w-[1400px]">
        <div className="docs-sidebar-slot hidden w-[272px] flex-none md:block" aria-hidden="true" />
        <main id="main-content" className="docs-main">
          <div className="docs-card mx-auto w-full max-w-[860px]">
            <article className="prose-docs w-full">{children}</article>
            <Pager />
          </div>
          <footer className="docs-footer">
            <p>
              Noren docs. The x402 gateway settles on Robinhood Chain (chain id 4663); Noren's own settlement contracts are coming soon.{" "}
              <a href={SITE_URL}>Main site</a> · <a href={SANDBOX_URL}>Sandbox</a> ·{" "}
              <a href={`${SITE_URL}/about#credits`}>Built on open-source Noren (Apache-2.0)</a>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
