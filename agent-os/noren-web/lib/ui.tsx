"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { formatDateTime, formatRelative } from "./format";

/** Copy-to-clipboard button for ids, hashes and results. */
export function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      // clipboard blocked: select-and-copy fallback is not worth the code
    }
  }, [value]);
  return (
    <button
      type="button"
      className={`copy-btn ${className}`}
      onClick={onClick}
      aria-label={`${label} ${value.slice(0, 12)}`}
    >
      {done ? "Copied" : label}
    </button>
  );
}

/** Hash/id chip: shortened text + copy button. */
export function HashChip({ value, label, length = 12 }: { value: string; label?: string; length?: number }) {
  if (!value) return null;
  const short = value.length > length ? `${value.slice(0, length)}…` : value;
  return (
    <span className="hash-chip">
      {label && <span className="hash-label">{label}</span>}
      <code title={value}>{short}</code>
      <CopyButton value={value} />
    </span>
  );
}

/** Relative time with the absolute time in the tooltip and a second line. */
export function When({ ms, block = false }: { ms: number; block?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(t);
    };
  }, []);
  const abs = formatDateTime(ms);
  return (
    <span className={block ? "when block" : "when"} title={abs}>
      <span>{now === null ? abs : formatRelative(ms, now)}</span>
      {block && now !== null && <em>{abs}</em>}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
      {action && (
        <Link href={action.href} className="btn primary small">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function friendlyError(message: string): string {
  if (/→ 401|→ 403/.test(message)) return "The sandbox didn't allow this request (not authorised).";
  if (/→ 429/.test(message)) return "Too many requests right now. Wait a moment and try again.";
  if (/→ 5\d\d/.test(message) || /Failed to fetch|daemon unavailable/.test(message))
    return "The sandbox service isn't responding right now.";
  return message.replace(/^\/[^ ]* → /, "");
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <div>
        <strong>Couldn&apos;t load this page</strong>
        <p>{friendlyError(message)}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-rows" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

export function Tile({
  label,
  value,
  caption,
  small,
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  small?: boolean;
}) {
  return (
    <article className="metric">
      <span className="eyebrow">{label}</span>
      <span className={small ? "value small" : "value"}>{value}</span>
      {caption && <span className="caption">{caption}</span>}
    </article>
  );
}

/** Standard loading / error / content switch for polled pages. */
export function DataGate({
  loading,
  error,
  onRetry,
  rows,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  rows?: number;
  children: ReactNode;
}) {
  if (loading && !error) return <SkeletonRows rows={rows} />;
  if (error && loading) return <ErrorState message={error} onRetry={onRetry} />;
  return (
    <>
      {error && (
        <p className="stale-note" role="status">
          Showing the last data received — {friendlyError(error)}
        </p>
      )}
      {children}
    </>
  );
}
