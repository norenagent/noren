import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <p className="eyebrow">Page not found</p>
      <h1 style={{ margin: "6px 0 10px", fontSize: 28, color: "var(--forest)" }}>We couldn&apos;t find that page</h1>
      <p className="text-muted" style={{ maxWidth: "60ch" }}>
        The link may be old, or the page may have moved. Try one of the main sections below.
      </p>
      <div className="actions-row" style={{ marginTop: 16 }}>
        <Link href="/" className="btn primary">Overview</Link>
        <Link href="/intents" className="btn">Tasks</Link>
        <Link href="/audit" className="btn">Activity</Link>
      </div>
    </section>
  );
}
