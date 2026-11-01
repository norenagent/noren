"use client";

import { useEffect, useState } from "react";

const RESET_AT = process.env.NEXT_PUBLIC_DEMO_RESET_AT_UTC ?? "";
const RESET_INTERVAL_HOURS = Number(process.env.NEXT_PUBLIC_DEMO_RESET_INTERVAL_HOURS ?? "");

function nextResetMs(now: number): number | null {
  if (RESET_AT) {
    const parsed = Date.parse(RESET_AT);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (Number.isFinite(RESET_INTERVAL_HOURS) && RESET_INTERVAL_HOURS > 0) {
    const intervalMs = RESET_INTERVAL_HOURS * 3_600_000;
    return Math.ceil(now / intervalMs) * intervalMs;
  }
  return null;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "resetting now";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}

function ResetCountdown() {
  // null until mounted: the server render must not depend on the clock.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setNow(Date.now()));
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(id);
    };
  }, []);

  if (now === null) return null;
  const target = nextResetMs(now);
  if (target === null) return null;
  return <span className="demo-count">next reset in {formatCountdown(target - now)}</span>;
}

export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "1") return null;
  return (
    <div className="demo-banner" role="status">
      <span className="demo-msg">
        <span className="demo-dot" aria-hidden />
        <span>
          <strong>Public sandbox</strong> · shared state · resets every 12 hours
        </span>
        <ResetCountdown />
      </span>
      <a
        className="demo-banner-link"
        href="https://docs.usenoren.xyz/getting-started"
        target="_blank"
        rel="noreferrer"
      >
        Run your own
      </a>
    </div>
  );
}
