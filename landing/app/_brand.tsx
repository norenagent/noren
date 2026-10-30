// Brand constants and inline icons. Centralised so /, /roadmap, /docs/*
// (and any future top-level page) share the same nav, X handle, GitHub
// repo, release status, and tagline without copy-paste drift.

import { workspaceRelease } from "./compute-workspaces/_release";
import { rentalChecksRelease } from "./compute-rental-checks/_release";

// The mark: four stacked bars, each carrying one diagonal stroke of an N. 667 x 656, near-square.
export const MARK_PATHS = [
  "M0 150 L69 150 L69 65 L146 150 L667 150 L667 0 L201 0 L201 95 L117 0 L0 0 Z",
  "M0 322 L201 322 L201 238 L276 322 L667 322 L667 176 L333 176 L333 264 L251 176 L0 176 Z",
  "M0 348 L0 490 L333 490 L333 408 L408 490 L667 490 L667 348 L463 348 L463 433 L384 348 Z",
  "M0 656 L463 656 L463 577 L536 656 L667 656 L667 516 L597 516 L597 603 L514 516 L0 516 Z"
];
export const MARK_VIEWBOX = { w: 667, h: 656 };

/**
 * The Noren mark, inline so it can take its brand colour or the current text colour.
 * Size it by height; the width follows the viewBox.
 */
export function NorenMark({
  tone = "ramp",
  className,
  title,
}: {
  tone?: "ramp" | "mono";
  className?: string;
  title?: string;
}) {
  const fill = tone === "mono" ? "currentColor" : "#1b492d";
  return (
    <svg
      viewBox="0 0 667 656"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      fill={fill}
    >
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The lockup: the mark beside the name, set in the mono. */
export function NorenLockup({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={["inline-flex items-center gap-3", className ?? ""].join(" ")}>
      <NorenMark tone="mono" className={markClassName ?? "h-7 w-auto"} />
      <span className="font-display text-[19px] font-extrabold leading-none tracking-[-0.03em]">Noren</span>
    </span>
  );
}

// Interim domains: change these three constants to rebrand.
export const SITE_URL = "https://usenoren.xyz";
export const DOCS_URL = "https://docs.usenoren.xyz";
export const SANDBOX_URL = "https://sandbox.usenoren.xyz";

export const UPSTREAM_URL = "https://github.com/norenagent/noren"; // attribution only (Apache-2.0)
export const TAGLINE = "An operating layer that agents can be held to";
export const RELEASE_STATUS = "ALPHA LIVE";

// Stable sitemap lastmod. Bump on a content/release change rather than
// emitting a fresh request-time clock (which churns lastmod on every crawl).
export const SITE_BUILD_DATE = "2026-10-28";

// Docs went live with the 0.1.0 release. Feeds TechArticle datePublished;
// dateModified tracks SITE_BUILD_DATE — only bump that on real content change.
export const DOCS_PUBLISHED_DATE = "2026-05-13";

// The side menu's primary nav: the most relevant surfaces only (products,
// learn, buy), set large. The rest of the site follows as MENU_LINKS, and
// everything is also in the footer.
export const NAV_LINKS = [
  { label: "compute", href: "/compute", external: false as const },
  { label: "guard", href: "/guard", external: false as const },
  { label: "trading", href: "/trading", external: false as const },
  { label: "docs", href: DOCS_URL, external: true as const },
  { label: "token", href: "/token", external: false as const },
];

export const FOOTER_LINKS = [
  { label: "FAQ", href: "/faq", external: false as const },
  { label: "Changelog", href: "/changelog", external: false as const },
  { label: "Partners", href: "/partners", external: false as const },
  { label: "Terms of Service", href: "/terms", external: false as const },
  { label: "Privacy Policy", href: "/privacy", external: false as const },
  { label: "Contact", href: "/contact", external: false as const },
];

// The Noren token on Robinhood Chain (chain 4663). Facts below were read from the contract itself.
export const NOREN_TOKEN = {
  address: "0xd7ccebb9a014a713879093979c7016db72486e62",
  name: "Noren Agents",
  symbol: "NOREN",
  decimals: 18,
  totalSupply: "1,000,000,000",
  chainId: 4663,
  explorer: "https://robinhoodchain.blockscout.com/token/0xd7ccebb9a014a713879093979c7016db72486e62",
} as const;

// The open protocols Noren speaks, shown as chips in the footer brand block.
export const FOOTER_PROTOCOLS = ["Robinhood Chain", "x402", "MCP", "A2A"];

export type FooterColumnLink = { label: string; href: string; external?: boolean };

// The structured, multi-column footer. Single source of truth so every page
// that mounts the full <SiteFooter /> stays in sync. Every href resolves to a
// real route or an external surface we own.
export const FOOTER_COLUMNS: { title: string; links: FooterColumnLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Guard", href: "/guard" },
      { label: "Trading", href: "/trading" },
      { label: "Compute", href: "/compute" },
      { label: "Sandbox", href: SANDBOX_URL, external: true },
      { label: "Agents", href: "/agents" },
      { label: "Arena", href: "/arena" },
      { label: "Token", href: "/token" },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { label: "Partners", href: "/partners" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: DOCS_URL, external: true },
      { label: "API Reference", href: `${DOCS_URL}/http-api` },
      ...(workspaceRelease.accepted ? [{ label: "Compute workspaces", href: "/compute-workspaces" }] : []),
      ...(rentalChecksRelease.accepted ? [{ label: "GPU rental checks", href: "/compute-rental-checks" }] : []),
      { label: "SDK", href: "/sdk" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Roadmap", href: "/roadmap" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

// The side menu's second tier: the rest of the site, beneath the primary nav.
export const MENU_LINKS = [
  { label: "About", href: "/about", external: false as const },
  { label: "Blog", href: "/blog", external: false as const },
  { label: "Roadmap", href: "/roadmap", external: false as const },
  { label: "Partners", href: "/partners", external: false as const },
  { label: "Agents", href: "/agents", external: false as const },
  { label: "Arena", href: "/arena", external: false as const },
  { label: "Contact", href: "/contact", external: false as const },
];

// Socials sit on the right of the header and at the foot of the side menu.
export const X_URL = "https://x.com/NorenAgent";
export const GITHUB_URL = "https://github.com/norenagent/noren";
export const SOCIAL_LINKS: { label: string; href: string; Icon: (p: { className?: string }) => React.ReactElement }[] = [
  { label: "X", href: X_URL, Icon: XIcon },
  { label: "GitHub", href: GITHUB_URL, Icon: GithubIcon },
];

export function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M17.53 3H20.5l-6.49 7.41L21.75 21h-6.18l-4.84-6.34L5.16 21H2.18l6.94-7.93L1.75 3h6.34l4.38 5.79L17.53 3Zm-1.08 16.2h1.71L7.66 4.7H5.83l10.62 14.5Z" />
    </svg>
  );
}

export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M21.94 4.51 18.9 19.2c-.23 1.02-.84 1.27-1.7.79l-4.7-3.47-2.27 2.18c-.25.25-.46.46-.94.46l.34-4.78 8.7-7.86c.38-.34-.08-.53-.59-.19L6.98 13.2 2.34 11.74c-1.01-.32-1.03-1.01.21-1.5l18.13-6.99c.84-.31 1.58.19 1.26 1.26Z" />
    </svg>
  );
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
      />
    </svg>
  );
}
