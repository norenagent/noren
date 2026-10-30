import { FooterCA } from "./FooterCA";
import type { CSSProperties } from "react";
import Link from "next/link";
import { HeaderStats } from "./HeaderStats";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { SiteMotion } from "./SiteMotion";
import { DOCS_URL, MARK_PATHS, SANDBOX_URL } from "./_brand";
import { PRIMITIVES } from "./_primitives";

const shell = "mx-auto w-full max-w-7xl px-5 sm:px-8";
const h2 = "type-display text-[clamp(1.7rem,3.4vw,2.6rem)] text-forest";
const sectionPad = "py-[clamp(48px,6vw,88px)]";

const legacyHost = (href: string) =>
  href
    .replace("https://docs.usenoren.xyz", DOCS_URL)
    .replace("https://usenoren.xyz", "https://usenoren.xyz");

const STEPS = [
  {
    n: "1",
    title: "Grant",
    body: "You issue a signed capability that names exactly what an agent may do, for how long, and within what limits.",
    href: "https://docs.usenoren.xyz/capabilities",
    tone: "bg-white",
  },
  {
    n: "2",
    title: "Act",
    body: "The agent runs under that grant. Anything outside it is refused before it happens, not logged after.",
    href: "https://docs.usenoren.xyz/primitives",
    tone: "bg-lime",
  },
  {
    n: "3",
    title: "Prove",
    body: "Every action leaves a receipt in a hash-chained audit log, so anyone can check what was done and under whose authority.",
    href: "https://docs.usenoren.xyz/audit",
    tone: "bg-mint",
  },
];

const PRODUCTS = [
  {
    name: "Guard",
    href: "/guard",
    tag: "Trust layer",
    body: "Before your agent pays or trusts another agent, it will check an on-chain track record, confirm a real identity, and verify a signed claim once the Robinhood Chain contracts are live. A zero-install MCP for Claude and Codex.",
    cta: "Explore Guard",
    tone: "bg-white",
  },
  {
    name: "Trading",
    href: "/trading",
    tag: "Governed execution",
    body: "Brokerages are opening to agents with no real limits. Noren is the policy gate in front of the order: caps enforced before it's placed, and every decision signed and, once the contracts are live, anchored on Robinhood Chain where anyone can check it.",
    cta: "See governed trading",
    tone: "bg-lime",
  },
];

function ArrowButton({ light = false }: { light?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] transition-transform duration-150 group-hover:translate-x-0.5 ${
        light ? "bg-white text-forest" : "bg-forest text-lime"
      }`}
    >
      →
    </span>
  );
}

/* ── Hero illustration ──────────────────────────────────────────────────────
   The mark is extruded from its own geometry: every outline edge that faces the
   viewer becomes a side wall, shaded by the direction it faces. That gives a
   crisp, physically consistent solid instead of stacked copies. */

type Pt = [number, number];

function parsePoly(d: string): Pt[] {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])] as Pt);
}

function mix(a: string, b: string, t: number): string {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

const EXTRUDE = 58; // depth, in mark units, toward the lower right
const SIDE_RIGHT = "#145a2e";
const SIDE_BOTTOM = "#26a050";

const SIDE_WALLS: Array<{ d: string; fill: string; order: number }> = MARK_PATHS.flatMap((path) => {
  const pts = parsePoly(path);
  const area = pts.reduce((sum, [x, y], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length];
    return sum + (x * y2 - x2 * y);
  }, 0);
  const sign = area > 0 ? 1 : -1;
  return pts.flatMap(([x1, y1], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (sign * dy) / len;
    const ny = (-sign * dx) / len;
    if (nx + ny <= 0.001) return []; // faces away from the extrusion direction
    const theta = (Math.atan2(ny, nx) * 180) / Math.PI;
    const t = Math.min(1, Math.max(0, theta / 90));
    return [
      {
        d: `M${x1} ${y1} L${x2} ${y2} L${x2 + EXTRUDE} ${y2 + EXTRUDE} L${x1 + EXTRUDE} ${y1 + EXTRUDE} Z`,
        fill: mix(SIDE_RIGHT, SIDE_BOTTOM, t),
        // walls nearer the lower right sit in front of those behind them
        order: (x1 + x2 + y1 + y2) / 2,
      },
    ];
  });
}).sort((p, q) => p.order - q.order);

type HeroBadge = {
  id: string;
  label: string;
  caption?: string;
  shape: "circle" | "pill" | "token";
  src: string;
  size: number; // logo size inside the badge
  x: number;
  y: number;
  dx: number; // drift, in viewBox units
  dy: number;
  dur: number; // seconds
  delay: number;
};

/** Real marks the product actually uses, each in a round badge that orbits the mark. */
const HERO_BADGES: HeroBadge[] = [
  { id: "robinhood", label: "Robinhood Chain", caption: "Robinhood", shape: "circle", src: "/brands/robinhood.svg", size: 46, x: 62, y: 104, dx: 5, dy: -9, dur: 6.5, delay: 0 },
  { id: "x402", label: "x402", shape: "pill", src: "/brands/x402.svg", size: 82, x: 560, y: 82, dx: -6, dy: 10, dur: 7.5, delay: -2 },
  { id: "usdg", label: "USDG", caption: "USDG", shape: "token", src: "/brands/usdg.png", size: 100, x: 572, y: 410, dx: 7, dy: -10, dur: 7, delay: -4 },
  { id: "mcp", label: "Model Context Protocol", caption: "MCP", shape: "circle", src: "/brands/mcp.svg", size: 44, x: 60, y: 420, dx: 7, dy: 9, dur: 8, delay: -1 },
];

const BADGE_R = 46;

function Badge({ b, index }: { b: HeroBadge; index: number }) {
  const style = {
    "--x": `${b.x}px`,
    "--y": `${b.y}px`,
    "--dx": `${b.dx}px`,
    "--dy": `${b.dy}px`,
    "--dur": `${b.dur}s`,
    "--delay": `${b.delay}s`,
  } as CSSProperties;
  const clipId = `hero-clip-${b.id}`;
  return (
    <g className="hero-badge" style={style} transform={`translate(${b.x} ${b.y})`} data-badge={index}>
      <title>{b.label}</title>
      {b.shape === "pill" ? (
        <>
          <rect x={-60} y={-31} width={120} height={62} rx={31} fill="#ffffff" />
          <rect x={-60} y={-31} width={120} height={62} rx={31} fill="none" stroke="#1f4723" strokeOpacity={0.14} strokeWidth={2} />
          <image href={b.src} x={-b.size / 2} y={-16} width={b.size} height={32} preserveAspectRatio="xMidYMid meet" />
        </>
      ) : b.shape === "token" ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <circle r={BADGE_R - 4} />
            </clipPath>
          </defs>
          <circle r={BADGE_R} fill="#ffffff" />
          <image href={b.src} x={-(BADGE_R - 4)} y={-(BADGE_R - 4)} width={(BADGE_R - 4) * 2} height={(BADGE_R - 4) * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
          <circle r={BADGE_R} fill="none" stroke="#1f4723" strokeOpacity={0.14} strokeWidth={2} />
        </>
      ) : (
        <>
          <circle r={BADGE_R} fill="#ffffff" />
          <circle r={BADGE_R} fill="none" stroke="#1f4723" strokeOpacity={0.14} strokeWidth={2} />
          <image href={b.src} x={-b.size / 2} y={-b.size / 2} width={b.size} height={b.size} preserveAspectRatio="xMidYMid meet" />
        </>
      )}
      {b.caption ? (
        <g transform={`translate(0 ${BADGE_R + 20})`}>
          <rect x={-(b.caption.length * 4.9 + 11)} y={-11} width={b.caption.length * 9.8 + 22} height={22} rx={11} fill="#ffffff" fillOpacity={0.92} />
          <text
            y={4.5}
            textAnchor="middle"
            fontSize={12.5}
            fontWeight={700}
            letterSpacing={0.4}
            fill="#1f4723"
            style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
          >
            {b.caption}
          </text>
        </g>
      ) : null}
    </g>
  );
}

function HeroVisual() {
  return (
    <svg
      viewBox="0 0 640 560"
      className="h-full w-full"
      role="img"
      aria-label="The Noren mark: four stacked bars, each with one diagonal stroke of an N"
    >
      <defs>
        <linearGradient id="hero-face" x1="0" y1="0" x2="667" y2="656" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f7ffa6" />
          <stop offset="0.34" stopColor="#c2f36b" />
          <stop offset="0.7" stopColor="#62d055" />
          <stop offset="1" stopColor="#25994a" />
        </linearGradient>
        <radialGradient id="hero-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#f0fe9b" stopOpacity="0.85" />
          <stop offset="0.55" stopColor="#d4f8a8" stopOpacity="0.4" />
          <stop offset="1" stopColor="#c4edc9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hero-stage" cx="50%" cy="46%" r="62%">
          <stop offset="0" stopColor="#3f9456" />
          <stop offset="0.6" stopColor="#2a7340" />
          <stop offset="1" stopColor="#1a5130" />
        </radialGradient>
        <radialGradient id="hero-floor" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#0f3a20" stopOpacity="0.34" />
          <stop offset="1" stopColor="#0f3a20" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="hero-face-clip">
          {MARK_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </clipPath>
      </defs>

      <ellipse cx="322" cy="262" rx="300" ry="256" fill="url(#hero-halo)" />
      <ellipse cx="322" cy="282" rx="248" ry="248" fill="url(#hero-stage)" />
      <ellipse cx="322" cy="282" rx="248" ry="248" fill="none" stroke="#f0fe9b" strokeOpacity="0.34" strokeWidth="1.8" />
      <ellipse cx="322" cy="282" rx="231" ry="231" fill="none" stroke="#f0fe9b" strokeOpacity="0.10" strokeWidth="1" strokeDasharray="2 7" />
      <ellipse cx="330" cy="520" rx="214" ry="24" fill="url(#hero-floor)" />

      {/* Orbit rings: the badges travel on these, so the motion reads as one system. */}
      <ellipse cx="322" cy="262" rx="294" ry="236" fill="none" stroke="#1f4723" strokeOpacity="0.16" strokeWidth="1.5" strokeDasharray="3 9" />
      <ellipse cx="322" cy="262" rx="268" ry="212" fill="none" stroke="#1f4723" strokeOpacity="0.10" strokeWidth="1.5" strokeDasharray="2 8" />

      <g className="hero-mark" transform="translate(126 78) scale(0.52)">
        {SIDE_WALLS.map((w, i) => (
          <path key={i} d={w.d} fill={w.fill} stroke={w.fill} strokeWidth={1.4} strokeLinejoin="round" />
        ))}
        {MARK_PATHS.map((d) => (
          <path key={d} d={d} fill="url(#hero-face)" />
        ))}
        <g clipPath="url(#hero-face-clip)">
          {/* inner bevel: a light edge that only shows inside the face */}
          <g fill="none" stroke="#ffffff" strokeOpacity="0.62" strokeWidth="9" strokeLinejoin="miter">
            {MARK_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          {/* a band of light that crosses the mark every few seconds */}
          <g className="hero-sheen">
            <rect x={-360} y={-120} width={170} height={960} fill="url(#hero-sheen)" transform="skewX(-22)" />
          </g>
        </g>
      </g>

      {HERO_BADGES.map((b, i) => (
        <Badge key={b.id} b={b} index={i} />
      ))}
    </svg>
  );
}

export default function Page() {
  return (
    <main id="main-content" className="relative min-h-screen overflow-x-clip bg-ground">
      <div className="sr-only">
        <p>
          Noren is the open, local-first operating layer for agentic software. It gives humans
          and agents eight host-level primitives (intent, runtime, memory, identity, permissions,
          communication, a compositor, and on-chain settlement) so they can safely share one
          computer. Try the <a href={SANDBOX_URL}>interactive sandbox</a>, read the{" "}
          <a href={`${DOCS_URL}/concepts`}>documentation on the eight primitives</a>, or review the{" "}
          <Link href="/roadmap">development roadmap</Link>.
        </p>
      </div>

      <SiteMotion />
      <SiteHeader />

      {/* Hero */}
      <section className="hero-block" aria-labelledby="hero-title">
        <div className={`${shell} grid items-center gap-6 pb-12 pt-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:pb-0 md:pt-10`}>
          <div className="flex flex-col items-start gap-7 md:py-10">
            <h1 id="hero-title" className="hero-display">
              An operating layer that agents can be held to.
            </h1>
            <p className="hero-sub">
              Every agent runs under a signed grant. Every action leaves a receipt in a hash-chained
              audit log. Eight primitives, built in the open.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={SANDBOX_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Try the interactive Noren sandbox"
                className="btn btn-primary"
              >
                Try the sandbox <span aria-hidden="true">→</span>
              </a>
              <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                Read the docs
              </a>
            </div>
            <p className="hero-note">Open source · Apache-2.0 · Alpha live. Settlement on Robinhood Chain.</p>
          </div>
          <div className="mx-auto aspect-[8/7] w-full max-w-[560px] md:mt-8 md:max-w-none">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={sectionPad} aria-labelledby="how-title">
        <div className={shell}>
          <h2 id="how-title" className={h2}>
            How Noren works
          </h2>
          <p className="mt-3 max-w-xl text-[17px] text-fg-soft">Permission, not trust. Three steps, every time.</p>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="reveal">
                <a
                  href={s.href}
                  className={`card card-link group relative flex min-h-[260px] h-full flex-col justify-between p-7 ${s.tone}`}
                  style={s.tone === "bg-white" ? undefined : { background: s.tone === "bg-lime" ? "#e2f3e4" : "#d6eed9" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-forest">{s.n}</span>
                    <ArrowButton />
                  </div>
                  <div>
                    <h3 className="type-display text-[1.9rem] text-forest">{s.title}</h3>
                    <p className="mt-3 text-[15px] leading-[1.55] text-fg-soft">{s.body}</p>
                    <span className="mt-5 block text-[13px] font-bold text-forest">Read the primitive <span aria-hidden="true">→</span></span>
                  </div>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Eight primitives */}
      <section className={sectionPad} aria-labelledby="primitives-title">
        <div className={shell}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] md:items-end md:gap-14">
            <h2 id="primitives-title" className={h2}>
              One computer, safely shared by humans and agents
            </h2>
            <p className="max-w-md text-[16px] leading-[1.55] text-fg-soft">
              Eight host-level primitives: intent, runtime, memory, identity, permissions,
              communication, a compositor, and on-chain settlement.
            </p>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRIMITIVES.slice(0, 8).map((p, i) => (
              <li key={p.slug} className="reveal">
                <a
                  href={legacyHost(p.docHref)}
                  className="card group flex h-full flex-col gap-3 p-6 transition-transform duration-200 hover:-translate-y-1"
                >
                  <span className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime font-mono text-[12px] font-semibold tabular-nums text-forest">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <ArrowButton />
                  </span>
                  <span className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-forest">{p.term}</span>
                  <span className="text-[14px] leading-[1.55] text-muted">{p.gloss}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Products */}
      <section className={sectionPad} aria-labelledby="products-title">
        <div className={shell}>
          <h2 id="products-title" className={h2}>
            Two ways agents meet the real world
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {PRODUCTS.map((prod) => (
              <article
                key={prod.href}
                className="reveal card flex flex-col p-8"
                style={prod.tone === "bg-lime" ? { background: "#e2f3e4" } : undefined}
              >
                <span className="text-[13px] font-semibold text-muted">{prod.tag}</span>
                <h3 className="type-display mt-2 text-[2.6rem] text-forest">{prod.name}</h3>
                <p className="mt-4 max-w-lg text-[15px] leading-[1.6] text-fg-soft">{prod.body}</p>
                <Link href={prod.href} className="group mt-8 inline-flex items-center gap-3 text-[15px] font-bold text-forest">
                  {prod.cta}
                  <ArrowButton />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Built in the open */}
      <section className={sectionPad} aria-labelledby="builds-title">
        <div className={shell}>
          <div className="rounded-[22px] bg-sunken p-7 sm:p-12">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-end md:gap-14">
              <h2 id="builds-title" className={h2}>
                Built to be <span className="text-ramp">checked</span>
              </h2>
              <div>
                <p className="text-[16px] leading-[1.6] text-fg-soft">
                  Every agent action runs under a signed grant, is checked before it goes through, and leaves a receipt in a hash-chained audit log. You can run the same daemon the sandbox uses and verify the chain yourself.</p>
                <a href="https://sandbox.usenoren.xyz" className="btn btn-primary mt-6">
                  Try the sandbox <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
            <div className="mt-10">
              <HeaderStats />
            </div>
          </div>
        </div>
      </section>

      {/* Robinhood Chain */}
      <section className={sectionPad} aria-labelledby="chain-title">
        <div className={shell}>
          <div className="reveal card grid gap-6 p-7 sm:p-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <h2 id="chain-title" className={h2}>
                Settlement on Robinhood Chain
              </h2>
              <p className="mt-4 max-w-xl text-[16px] leading-[1.6] text-fg-soft">
                Chain 4663, settled in USDG. Pay-per-call over x402, tools and agent-to-agent traffic over
                MCP and A2A. The Noren token is deployed on the same chain.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Protocols">
                {["Robinhood Chain", "USDG", "x402", "MCP", "A2A"].map((n) => (
                  <li key={n} className="rounded-full bg-ground px-4 py-1.5 text-[13px] font-semibold text-forest">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <span className="text-[13px] font-semibold text-muted">The Noren token · CA</span>
              <FooterCA tone="light" />
              <Link href="/token" className="text-[14px] font-semibold text-forest underline decoration-line-strong underline-offset-4">
                About the token
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-[clamp(48px,6vw,88px)]" aria-labelledby="cta-title">
        <div className={shell}>
          <div
            className="reveal flex flex-col items-start gap-8 rounded-[22px] p-8 sm:p-14 md:flex-row md:items-center md:justify-between"
            style={{ background: "#d6eed9" }}
          >
            <h2 id="cta-title" className="type-display text-[clamp(1.9rem,4vw,3rem)] text-forest">
              Try the sandbox
            </h2>
            <div className="flex shrink-0 flex-wrap gap-3">
              <a
                href={SANDBOX_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn !bg-forest !text-lime hover:!bg-forest-deep"
              >
                Try the sandbox <span aria-hidden="true">→</span>
              </a>
              <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                Read the docs
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
