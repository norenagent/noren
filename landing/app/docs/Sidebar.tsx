"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NorenLockup } from "../_brand";
import { DOCS_NAV } from "./_nav";

export function Sidebar({ webUrl, sandboxUrl }: { webUrl: string; sandboxUrl: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // docs.* rewrites to /docs/<slug>; DOCS_NAV hrefs have no /docs prefix.
  const slug = pathname.replace(/^\/docs/, "") || "/";

  return (
    <>
      <header className="docs-topbar">
        <a href={webUrl} aria-label="Noren home" className="inline-flex">
          <NorenLockup markClassName="h-7 w-auto" />
        </a>
        <Link href="/" className="docs-label">Docs</Link>
        <span className="docs-spacer" />
        <a href={webUrl} className="docs-pill docs-hide-sm">← Main site</a>
        <a href={sandboxUrl} className="docs-pill docs-pill-lime docs-hide-sm">Sandbox</a>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-expanded={open}
          className="docs-pill docs-menu-btn"
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>

      <aside className="docs-sidebar" data-open={open}>
        <nav aria-label="Documentation" className="space-y-7">
          {DOCS_NAV.map((section) => (
            <div key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={slug === item.href ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="md:hidden">
            <h3>Elsewhere</h3>
            <ul>
              <li><a href={webUrl}>Main site</a></li>
              <li><a href={sandboxUrl}>Sandbox</a></li>
            </ul>
          </div>
        </nav>
      </aside>
    </>
  );
}
