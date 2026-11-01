import Link from "next/link";
import { HeaderShell } from "./HeaderShell";
import { SiteMenu } from "./SiteMenu";
import { NorenLockup, NAV_LINKS, SANDBOX_URL, SOCIAL_LINKS } from "./_brand";

/**
 * Site-wide header: a light top bar with the lockup on the left, nav pills on
 * md+, and the menu button (the only nav on phones) on the right.
 */
export function SiteHeader() {
  return (
    <HeaderShell>
      <div className="mx-auto flex h-(--header-h) w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="Noren home" className="shrink-0 text-forest">
          <NorenLockup markClassName="h-[30px] w-auto sm:h-[36px]" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full px-4 py-2 text-[14px] font-semibold capitalize text-forest transition-colors hover:bg-white"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-[14px] font-semibold capitalize text-forest transition-colors hover:bg-white"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {SOCIAL_LINKS.map(({ label, href, Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Noren on ${label}`}
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-forest/15 text-forest transition-colors hover:bg-forest hover:text-white sm:inline-flex"
            >
              <Icon className="h-[15px] w-[15px]" />
            </a>
          ))}
          <a
            href={SANDBOX_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary hidden !min-h-[40px] !px-5 lg:inline-flex"
          >
            Try the sandbox
          </a>
          <SiteMenu />
        </div>
      </div>
    </HeaderShell>
  );
}
