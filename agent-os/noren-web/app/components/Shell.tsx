"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useDeveloperMode } from "@/lib/developerMode";
import { useRightRailActive, useRightRailSlotRef } from "@/lib/rightRail";
import { CommandPalette } from "./CommandPalette";
import { NorenMark } from "./Mark";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
const SITE_URL = "https://usenoren.xyz";

/** Lets any button open the command palette without sharing state. */
export const OPEN_PALETTE_EVENT = "noren:open-palette";

type NavItem = { href: string; label: string; key?: string };

// The six core sections are always visible. Advanced pages (agent messages,
// credit metering, generations, settlement plan) sit behind the
// "Advanced pages" toggle.
const CORE_NAV: ReadonlyArray<NavItem> = [
  { href: "/", label: "Overview", key: "o" },
  { href: "/intents", label: "Tasks", key: "t" },
  { href: "/audit", label: "Activity", key: "a" },
  { href: "/capabilities", label: "Permissions", key: "p" },
  { href: "/memory", label: "Memory", key: "m" },
  { href: "/workspace", label: "Workspace", key: "w" },
  { href: "/peers", label: "Agents", key: "r" },
];

const ADVANCED_NAV: ReadonlyArray<NavItem> = [
  { href: "/queues", label: "Messages" },
  { href: "/settlement", label: "Spending" },
  { href: "/generations", label: "Generations" },
  { href: "/sap", label: "Settlement" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [advanced, setAdvanced] = useDeveloperMode();
  const hasRail = useRightRailActive();
  const railSlotRef = useRightRailSlotRef();
  const onAdvancedPage = ADVANCED_NAV.some((i) => isActive(pathname, i.href));
  const showAdvanced = advanced || onAdvancedPage;
  const visibleNav = showAdvanced ? [...CORE_NAV, ...ADVANCED_NAV] : CORE_NAV;

  // g-prefix navigation: `g` then a letter within 1.5s. The footer lists
  // exactly the core shortcuts that are wired here.
  const gArmedAt = useRef(0);
  useEffect(() => {
    const map = new Map(CORE_NAV.map((s) => [s.key, s.href]));
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "g") {
        gArmedAt.current = Date.now();
        return;
      }
      if (Date.now() - gArmedAt.current > 1500) return;
      const href = map.get(e.key);
      if (href) {
        e.preventDefault();
        gArmedAt.current = 0;
        router.push(href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-in">
          {DEMO_MODE ? (
            <a href={SITE_URL} className="brand" aria-label="Noren home (usenoren.xyz)">
              <span className="mark" aria-hidden>
                <NorenMark height={26} />
              </span>
              <span className="brand-text">
                <strong>Noren</strong>
                <em>· Sandbox</em>
              </span>
            </a>
          ) : (
            <Link href="/" className="brand" aria-label="Noren control panel home">
              <span className="mark" aria-hidden>
                <NorenMark height={26} />
              </span>
              <span className="brand-text">
                <strong>Noren</strong>
                <em>· Control panel</em>
              </span>
            </Link>
          )}

          <nav aria-label="Main navigation">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(pathname, item.href) ? "nav-link active" : "nav-link"}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                prefetch={false}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            className={advanced ? "dev-toggle on" : "dev-toggle"}
            onClick={() => setAdvanced(!advanced)}
            aria-pressed={advanced}
            title="Show advanced pages: Messages, Spending, Generations and Settlement"
          >
            <span className="dev-dot" aria-hidden />
            Advanced pages
          </button>
        </div>
      </header>

      <div className={hasRail ? "body with-rail" : "body"}>
        <main className="surface" id="main">
          {children}
        </main>

        <aside
          className="context-rail"
          aria-label="page context"
          ref={railSlotRef}
          hidden={!hasRail}
        />
      </div>

      <footer className="site-foot">
        <div className="site-foot-in">
          <div>
            <strong>Noren · Sandbox</strong>
            <p>
              {DEMO_MODE ? "Public sandbox · shared state" : "Running on this machine"}
              {" · "}
              <Link href="/sap" className="foot-link">
                Settlement on Robinhood Chain (4663): coming soon
              </Link>
              .
            </p>
          </div>
          <nav className="foot-keys" aria-label="Keyboard shortcuts">
            <button
              type="button"
              className="foot-key"
              onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
              title="Quick actions (Ctrl+K on Windows and Linux)"
            >
              <kbd>⌘K</kbd>
              <span>quick actions</span>
            </button>
            {CORE_NAV.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                prefetch={false}
                className="foot-key"
                title={`Keyboard: press g, then ${s.key}`}
              >
                <kbd>{`g ${s.key}`}</kbd>
                <span>{s.label.toLowerCase()}</span>
              </Link>
            ))}
          </nav>
        </div>
      </footer>

      <CommandPalette />

      <style jsx global>{`
        .shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
        }

        .skip-link {
          position: absolute;
          left: -9999px;
          top: 8px;
          z-index: 100;
          padding: 10px 16px;
          border-radius: 12px;
          background: var(--forest);
          color: #fff;
        }

        .skip-link:focus {
          left: 12px;
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 30;
          padding: 10px 20px 0;
          background: linear-gradient(var(--bg) 75%, rgba(234, 245, 236, 0));
        }

        .topbar-in {
          display: flex;
          align-items: center;
          gap: 16px;
          max-width: 1240px;
          margin: 0 auto;
          padding: 8px 12px 8px 16px;
          border: 1px solid var(--border-soft);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: var(--shadow);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 40px;
          color: var(--forest);
          flex: 0 0 auto;
        }

        .brand .mark {
          display: flex;
        }

        .brand-text {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .brand strong {
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .brand em {
          color: var(--muted);
          font-size: 14px;
          font-style: normal;
          font-weight: 500;
        }

        .topbar nav {
          display: flex;
          flex: 1;
          gap: 2px;
          min-width: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .topbar nav::-webkit-scrollbar {
          display: none;
        }

        .nav-link {
          display: inline-flex;
          align-items: center;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          color: var(--fg-soft);
          font-size: 14.5px;
          font-weight: 500;
          white-space: nowrap;
          transition: background 120ms ease, color 120ms ease;
        }

        .nav-link:hover {
          background: var(--bg);
          color: var(--forest);
        }

        .nav-link.active {
          background: var(--lime);
          color: var(--forest);
          font-weight: 700;
        }

        .dev-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
          min-height: 40px;
          padding: 0 12px;
          border: 1px solid var(--border-soft);
          border-radius: 12px;
          background: transparent;
          color: var(--muted);
          font-size: 13px;
          font-weight: 500;
          transition: background 120ms ease;
        }

        .dev-toggle:hover {
          background: var(--bg);
        }

        .dev-toggle .dev-dot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          border: 2px solid var(--muted-2);
        }

        .dev-toggle.on {
          color: var(--forest);
          border-color: var(--border-strong);
        }

        .dev-toggle.on .dev-dot {
          background: var(--forest);
          border-color: var(--forest);
        }

        .body {
          flex: 1;
          width: 100%;
          max-width: 1240px;
          margin: 0 auto;
          padding-top: 10px;
        }

        .body.with-rail {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          align-items: start;
        }

        .body.with-rail .surface {
          max-width: none;
          margin: 0;
        }

        .context-rail {
          display: grid;
          gap: 20px;
          align-content: start;
          margin: 12px 32px 72px 0;
          position: sticky;
          top: 88px;
          padding: 20px;
          border: 1px solid var(--border-soft);
          border-radius: var(--radius);
          background: #ffffff;
          box-shadow: var(--shadow);
        }

        .context-rail .record {
          grid-template-columns: minmax(0, 1fr);
          gap: 6px;
          padding: 12px 14px;
        }

        .site-foot {
          margin-top: 24px;
          padding: 32px 24px 28px;
          border-radius: 20px 20px 0 0;
          background: var(--forest-deep);
          color: #c4edc9;
        }

        .site-foot-in {
          display: flex;
          justify-content: space-between;
          gap: 28px;
          flex-wrap: wrap;
          max-width: 1240px;
          margin: 0 auto;
        }

        .site-foot strong {
          color: #ffffff;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .site-foot p {
          margin: 6px 0 0;
          font-size: 14px;
        }

        .foot-link {
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .foot-keys {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          max-width: 520px;
        }

        .foot-key {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 10px 5px 6px;
          border: 0;
          border-radius: 10px;
          background: rgba(196, 237, 201, 0.1);
          color: #c4edc9;
          font: inherit;
          font-size: 13px;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .foot-key:hover {
          background: rgba(196, 237, 201, 0.22);
          transform: translateY(-1px);
        }

        .foot-key:focus-visible {
          outline: 2px solid #f0fe9b;
          outline-offset: 2px;
        }

        .foot-key kbd {
          padding: 2px 7px;
          border-radius: 7px;
          background: rgba(196, 237, 201, 0.16);
          color: #ffffff;
          font-family: var(--font-mono);
          font-size: 11px;
        }

        @media (prefers-reduced-motion: reduce) {
          .foot-key {
            transition: none;
          }
          .foot-key:hover {
            transform: none;
          }
        }

        @media (max-width: 1200px) {
          .body.with-rail {
            grid-template-columns: 1fr;
          }
          .context-rail {
            position: static;
            margin: 0 32px 56px;
          }
        }

        @media (max-width: 900px) {
          .topbar {
            padding: 8px 12px 0;
          }
          .topbar-in {
            flex-wrap: wrap;
            gap: 6px 10px;
            padding: 8px 10px;
          }
          .topbar nav {
            order: 3;
            flex: 1 0 100%;
          }
          .dev-toggle {
            margin-left: auto;
          }
          .context-rail {
            margin: 0 16px 40px;
            padding: 16px;
          }
          .foot-keys {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
