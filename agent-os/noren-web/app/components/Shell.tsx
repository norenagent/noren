"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useDeveloperMode } from "@/lib/developerMode";
import { useRightRailActive, useRightRailSlotRef } from "@/lib/rightRail";
import { CommandPalette } from "./CommandPalette";
import { NorenMark } from "./Mark";
import { DemoBanner } from "./DemoBanner";
import { WalletButton } from "./WalletButton";

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
  { href: "/workspace", label: "Workspace", key: "w" },
  { href: "/intents", label: "Tasks", key: "t" },
  { href: "/audit", label: "Activity", key: "a" },
  { href: "/capabilities", label: "Permissions", key: "p" },
  { href: "/memory", label: "Memory", key: "m" },
  { href: "/peers", label: "Agents", key: "r" },
];

const ADVANCED_NAV: ReadonlyArray<NavItem> = [
  { href: "/queues", label: "Messages" },
  { href: "/settlement", label: "Spending" },
  { href: "/generations", label: "Generations" },
  { href: "/sap", label: "Settlement" },
];


type IconProps = { d: string };
const ICONS: Record<string, string> = {
  "/": "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  "/intents": "M5 4.5h14v15H5zM9 9h6M9 13h6M9 16.5h3",
  "/audit": "M4 12h3.5l2.5-6 4 12 2.5-6H20",
  "/capabilities": "M12 3 5 6v5.5c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6zM9 12l2.2 2.2L15.5 10",
  "/memory": "M4.5 7c0-1.4 3.4-2.5 7.5-2.5S19.5 5.6 19.5 7 16.1 9.5 12 9.5 4.5 8.4 4.5 7zM4.5 7v5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V7M4.5 12v5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-5",
  "/workspace": "M8 8 4 12l4 4M16 8l4 4-4 4M13.5 5.5l-3 13",
  "/peers": "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 6.5a2.5 2.5 0 0 1 0 5M17.5 14.2c2 .5 3.2 2.2 3.2 4.8",
  "/queues": "M4 6.5h16v11H4zM4 7l8 6 8-6",
  "/settlement": "M12 4v16M16 8.2c0-1.5-1.8-2.5-4-2.5s-4 1-4 2.5 1.8 2.3 4 2.8 4 1.3 4 2.8-1.8 2.5-4 2.5-4-1-4-2.5",
  "/generations": "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  "/sap": "M4 10 12 4l8 6M5.5 10v8M10 10v8M14 10v8M18.5 10v8M3.5 19.5h17",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
};
function NavIcon({ name }: { name: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name] ?? ICONS["/"]} />
    </svg>
  );
}

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
      <aside className="side" aria-label="Sandbox navigation">
        <div className="side-top">
          {DEMO_MODE ? (
            <a href={SITE_URL} className="brand" aria-label="Noren home (usenoren.xyz)">
              <span className="mark" aria-hidden>
                <NorenMark height={26} color="#f0fe9b" />
              </span>
              <span className="brand-text">
                <strong>Noren</strong>
                <em>· Sandbox</em>
              </span>
            </a>
          ) : (
            <Link href="/" className="brand" aria-label="Noren control panel home">
              <span className="mark" aria-hidden>
                <NorenMark height={26} color="#f0fe9b" />
              </span>
              <span className="brand-text">
                <strong>Noren</strong>
                <em>· Control panel</em>
              </span>
            </Link>
          )}
        </div>

        <button
          type="button"
          className="side-search"
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
          title="Quick actions (Ctrl+K on Windows and Linux)"
        >
          <NavIcon name="search" />
          <span>Search or jump to…</span>
          <kbd>⌘K</kbd>
        </button>

        <nav aria-label="Main navigation" className="side-nav">
          {CORE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(pathname, item.href) ? "nav-link active" : "nav-link"}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              prefetch={false}
            >
              <NavIcon name={item.href} />
              <span>{item.label}</span>
            </Link>
          ))}

          {showAdvanced && (
            <>
              <span className="side-label">Advanced</span>
              {ADVANCED_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive(pathname, item.href) ? "nav-link active" : "nav-link"}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  prefetch={false}
                >
                  <NavIcon name={item.href} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="side-bottom">
          <WalletButton />
          <DemoBanner />
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
      </aside>

      <div className="content">
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

      </div>

      <CommandPalette />

      <style jsx global>{`
        .shell {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 272px minmax(0, 1fr);
          background: transparent;
        }

        .content {
          min-width: 0;
          display: flex;
          flex-direction: column;
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

        .side {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 18px 14px 14px;
          background: rgba(6, 16, 10, 0.5);
          border-right: 1px solid var(--border-soft);
          backdrop-filter: blur(28px) saturate(160%);
          -webkit-backdrop-filter: blur(28px) saturate(160%);
          overflow-y: auto;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 40px;
          padding: 0 6px;
          color: var(--forest);
        }

        .brand .mark { display: flex; }
        .brand-text { display: flex; align-items: baseline; gap: 6px; }
        .brand strong { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }
        .brand em { color: var(--muted); font-size: 13px; font-style: normal; font-weight: 500; }

        .side-search {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 40px;
          padding: 0 10px;
          border: 1px solid var(--border-soft);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.22);
          color: var(--muted);
          font-size: 14px;
          text-align: left;
          transition: background 120ms ease, border-color 120ms ease;
        }
        .side-search span { flex: 1; }
        .side-search:hover { background: rgba(0, 0, 0, 0.32); border-color: var(--border); }
        .side-search kbd {
          padding: 1px 7px;
          border-radius: 6px;
          background: rgba(245, 243, 236, 0.12);
          color: var(--fg-soft);
          font-family: var(--font-mono);
          font-size: 11px;
        }

        .side-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; min-height: 0; }

        .side-label {
          margin: 16px 10px 6px;
          color: var(--faint);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          color: var(--fg-soft);
          font-size: 14.5px;
          font-weight: 500;
          white-space: nowrap;
          transition: background 120ms ease, color 120ms ease;
        }
        .nav-link svg { flex: none; opacity: 0.85; }
        .nav-link:hover { background: rgba(245, 243, 236, 0.1); color: #fff; }
        .nav-link.active {
          background: rgba(240, 254, 155, 0.16);
          box-shadow: inset 0 0 0 1px rgba(240, 254, 155, 0.3);
          color: #f0fe9b;
          font-weight: 700;
        }
        .nav-link.active svg { opacity: 1; }

        .side-bottom { display: flex; flex-direction: column; gap: 10px; }

        .dev-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
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
        .dev-toggle:hover { background: rgba(245, 243, 236, 0.08); }
        .dev-toggle .dev-dot { width: 9px; height: 9px; border-radius: 999px; border: 2px solid var(--muted-2); }
        .dev-toggle.on { color: var(--forest); border-color: var(--border-strong); }
        .dev-toggle.on .dev-dot { background: #f0fe9b; border-color: #f0fe9b; }

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
          background: var(--panel);
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
          align-items: flex-start;
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 32px;
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
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          width: 560px;
          max-width: 100%;
        }

        @media (max-width: 760px) {
          .site-foot-in { padding: 0; }
          .foot-keys { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
        }

        .foot-key {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px 7px 8px;
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
          white-space: nowrap;
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
          .shell { grid-template-columns: 1fr; }
          .side {
            position: sticky;
            z-index: 30;
            height: auto;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px 10px;
            padding: 10px 12px;
            border-right: 0;
            border-bottom: 1px solid var(--border-soft);
          }
          .side-search, .side-bottom, .side-label { display: none; }
          .side-nav { flex: 1 0 100%; flex-direction: row; overflow-x: auto; scrollbar-width: none; order: 3; }
          .nav-link { min-height: 36px; padding: 0 10px; }
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
