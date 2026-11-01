"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NorenLockup, MENU_LINKS, NAV_LINKS, SANDBOX_URL, SOCIAL_LINKS } from "./_brand";

type MenuItem = { label: string; href: string; external?: boolean };

function MenuLink({ item, className, onNavigate, current, children, style }: {
  item: MenuItem;
  className: string;
  onNavigate: () => void;
  current: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return item.external ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={className} style={style}>
      {children}
    </a>
  ) : (
    <Link href={item.href} onClick={onNavigate} aria-current={current ? "page" : undefined} className={className} style={style}>
      {children}
    </Link>
  );
}

/**
 * The site menu: a hamburger at the right of the header that opens a panel
 * from the right edge, at every width. The primary nav is set large, with the
 * rest of the site beneath it, the sandbox, the socials, and a seam of the
 * field at its foot. Escape, the backdrop or a link closes it; focus stays
 * inside while it is open and returns to the button after.
 */
export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Navigating closes the menu.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    close.current?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const dismiss = () => setOpen(false);
  // Items rise in after the panel, 55ms apart, on the brand curve.
  const rise = (i: number): React.CSSProperties => ({
    transitionDelay: open ? `${120 + i * 55}ms` : "0ms",
  });
  const riseClass = `transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
    open ? "translate-y-0 opacity-100" : "translate-y-[18px] opacity-0 motion-reduce:translate-y-0"
  }`;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-forest transition-colors hover:bg-lime"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Portaled to the body: the header carries a backdrop-filter, which makes
          it the containing block for fixed children, so in place the panel
          would clamp to the header's height instead of the viewport. */}
      {mounted &&
        createPortal(
          <>
            <div
              aria-hidden
              onClick={dismiss}
              className={`fixed inset-0 z-50 bg-forest-deep/40 backdrop-blur-[3px] transition-opacity duration-300 ${
                open ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />

            <div
              ref={panel}
              id="site-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              inert={!open}
              className={`fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full flex-col overflow-y-auto rounded-l-[32px] bg-ground transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:w-[420px] ${
                open ? "translate-x-0" : "translate-x-full"
              }`}
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="flex h-(--header-h) shrink-0 items-center justify-between pl-6 pr-4 sm:pl-8 sm:pr-6">
                <Link href="/" aria-label="Noren home" onClick={dismiss}>
                  <NorenLockup markClassName="h-[26px] w-auto sm:h-[30px]" />
                </Link>
                <button
                  ref={close}
                  type="button"
                  aria-label="Close menu"
                  onClick={dismiss}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-forest transition-colors hover:bg-lime"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav aria-label="Primary" className="px-6 pt-4 sm:px-8">
                <ul className="flex flex-col">
                  {NAV_LINKS.map((item, i) => {
                    const current = !item.external && pathname === item.href;
                    return (
                      <li key={item.href} className="border-b border-line-soft">
                        <MenuLink
                          item={item}
                          current={current}
                          onNavigate={dismiss}
                          style={rise(i)}
                          className={`group flex items-center gap-5 py-4 ${riseClass}`}
                        >
                          <span aria-hidden="true" className="w-6 shrink-0 font-mono text-[12px] tracking-widest text-muted">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className={`type-display flex-1 text-[2rem] capitalize ${current ? "text-green" : "text-forest"}`}>
                            {item.label}
                          </span>
                          <span
                            aria-hidden="true"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-[15px] text-lime transition-transform duration-150 group-hover:translate-x-1"
                          >
                            →
                          </span>
                        </MenuLink>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-6 pt-8 sm:px-8">
                {MENU_LINKS.map((item, i) => (
                  <MenuLink
                    key={item.href}
                    item={item}
                    current={pathname === item.href}
                    onNavigate={dismiss}
                    style={rise(NAV_LINKS.length + i / 2)}
                    className={`py-2 text-[15px] font-semibold text-muted transition-colors hover:text-forest aria-[current=page]:text-forest ${riseClass}`}
                  >
                    {item.label}
                  </MenuLink>
                ))}
              </div>

              <div className={`flex flex-wrap items-center justify-between gap-4 px-6 pt-8 sm:px-8 ${riseClass}`} style={rise(NAV_LINKS.length + 4)}>
                <a
                  href={SANDBOX_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={dismiss}
                  className="btn btn-primary"
                >
                  Try the sandbox <span aria-hidden="true">→</span>
                </a>
                <div className="flex items-center gap-1">
                  {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Noren on ${label}`}
                      onClick={dismiss}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-forest/20 text-forest transition-colors hover:bg-forest hover:text-white"
                    >
                      <Icon className="h-[17px] w-[17px]" />
                    </a>
                  ))}
                </div>
              </div>

              <div className="mt-auto h-10" />
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
