import { FooterCA } from "./FooterCA";
import Link from "next/link";
import {
  NorenLockup,
  NorenMark,
  FOOTER_COLUMNS,
  FOOTER_LINKS,
  FOOTER_PROTOCOLS,
  SOCIAL_LINKS,
  type FooterColumnLink,
  TAGLINE,
} from "./_brand";

type SiteFooterProps = {
  /** Extra classes for the outer <footer>. Pages own positioning. */
  className?: string;
  /** Inline styles for the outer <footer>. Useful for safe-area insets. */
  style?: React.CSSProperties;
  /**
   * `full` (default) is the multi-column footer. `minimal` is the single
   * centered row, for the hero and full-screen dashboard views where a tall
   * footer doesn't fit.
   */
  variant?: "full" | "minimal";
};

function FooterLink({ item, className }: { item: FooterColumnLink; className?: string }) {
  const cls = ["transition-colors", className ?? ""].filter(Boolean).join(" ");
  return item.external ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={cls}>
      {item.label}
    </a>
  ) : (
    <Link href={item.href} className={cls}>
      {item.label}
    </Link>
  );
}

/**
 * Site-wide footer. The link columns, tagline and protocol chips come from `_brand.tsx`, so every page that mounts the footer stays
 * in sync. Dark forest, rounded at the top; pages only own their padding.
 */
export function SiteFooter({ className, style, variant = "full" }: SiteFooterProps) {
  if (variant === "minimal") {
    return (
      <footer
        className={[
          "flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-center text-[13px] font-medium text-muted",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={style}
      >
        <NorenMark tone="mono" className="h-6 w-auto text-forest" title="Noren" />
        <nav aria-label="Footer" className="contents">
          {FOOTER_LINKS.map((item) => (
            <FooterLink key={item.href} item={item} className="hover:text-forest" />
          ))}
        </nav>
      </footer>
    );
  }

  return (
    <footer
      className={["site-footer mt-16 w-full text-[14px]", className ?? ""].filter(Boolean).join(" ")}
      style={style}
    >
      <div className="mx-auto w-full max-w-7xl px-5 pb-8 pt-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[minmax(240px,1.5fr)_repeat(5,minmax(0,1fr))] md:gap-[clamp(24px,3vw,48px)]">
          <div className="max-w-xs">
            <NorenLockup className="text-lime" markClassName="h-8 w-auto" />
            <p className="mt-5 text-[14px] leading-relaxed text-[#9fc7a5]">{TAGLINE}.</p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Protocols">
              {FOOTER_PROTOCOLS.map((name) => (
                <li key={name} className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-[#c4edc9]">
                  {name}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center gap-2">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Noren on ${label}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-[#c4edc9] transition-colors hover:bg-lime hover:text-forest"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[13px] font-extrabold text-lime">{col.title}</h3>
              <ul className="mt-4 space-y-2.5 text-[14px]">
                {col.links.map((item) => (
                  <li key={item.href}>
                    <FooterLink item={item} className="text-[#c4edc9] hover:text-white" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <a href="/token" className="text-[13px] font-semibold text-[#c4edc9] hover:text-white">The Noren token · CA</a>
          <FooterCA />
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-x-6 gap-y-2 text-[13px] text-[#9fc7a5]">
          <span>© 2026 Noren</span>
          <a
            href="/about#credits"
            className="transition-colors hover:text-white"
          >
            Source code license: Apache-2.0 <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
