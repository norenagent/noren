import Link from "next/link";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

type Props = {
  eyebrow: string;
  title: string;
  lede: string;
  points?: string[];
};

/** One honest panel for features that have not shipped on Robinhood Chain yet.
 *  No addresses, prices or numbers: only what the feature will do. */
export function ComingSoon({ eyebrow, title, lede, points = [] }: Props) {
  return (
    <main className="min-h-screen bg-ground">
      <SiteHeader />
      <div className="page-container">
        <p className="text-[13px] font-semibold text-muted">{eyebrow}</p>
        <h1 className="page-title mt-3 text-fg">{title}</h1>
        <div className="mt-10 max-w-2xl rounded-3xl bg-raised p-8 shadow-[0_12px_32px_-16px_rgba(31,71,35,0.18)] sm:p-10">
          <span className="inline-flex items-center rounded-full bg-lime px-4 py-1.5 text-[13px] font-bold text-forest">
            Coming soon on Robinhood Chain
          </span>
          <p className="mt-6 text-[16px] leading-relaxed text-fg-soft">{lede}</p>
          {points.length > 0 && (
            <ul className="mt-6 space-y-3 text-[15px] text-muted">
              {points.map((p) => (
                <li key={p} className="flex gap-3">
                  <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-green" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="btn btn-primary">Back to home</Link>
            <a href="https://docs.usenoren.xyz" className="btn btn-secondary">Read the docs</a>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
