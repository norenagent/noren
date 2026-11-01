"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "./_nav";

export function Pager() {
  const pathname = usePathname();
  const slug = pathname.replace(/^\/docs/, "") || "/";
  const flat = DOCS_NAV.flatMap((s) => s.items);
  const i = flat.findIndex((x) => x.href === slug);
  if (i < 0) return null;
  const prev = flat[i - 1];
  const next = flat[i + 1];
  return (
    <nav aria-label="Pagination" className="docs-pager">
      {prev ? (
        <Link href={prev.href} className="docs-pill">← {prev.label}</Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="docs-pill docs-pill-lime">{next.label} →</Link>
      ) : null}
    </nav>
  );
}
