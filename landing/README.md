# Noren landing

The public Noren site, documentation host, and pre-release product pages. It is served on `usenoren.xyz` (landing and docs), with the sandbox on `sandbox.usenoren.xyz` and the x402 gateway on `gateway.usenoren.xyz`.

## Development

```sh
pnpm install
pnpm dev          # http://localhost:3001
```

`pnpm build` performs the production Next build and checks social-card coverage. `pnpm test` runs the landing test suite and `pnpm typecheck` checks TypeScript.

The docs host is served from `app/docs` through `middleware.ts`. Run the production server on every interface; binding only to `127.0.0.1` prevents host-based docs routing from resolving correctly.

## Current public boundary

Noren's landing is intentionally honest about what is available today:

- The local control plane, sandbox, signed audit trail, permissions, memory, and task flow are the active product surfaces.
- The x402 gateway and facilitator on Robinhood Chain (USDG) are live; the sandbox workspace and code agent run under gVisor.
- Robinhood Chain settlement contracts, the Noren token, staking, paid trust reads, and Compute are pre-launch. Their pages must remain explicit about their unavailable state.
- The former live Compute proxy/data routes, agent stream, staking UI, public witness UI, and Noren brand-kit pages were retired. Do not recreate a client, API route, or claim for them without a verified Noren-backed service.
- Retired public URLs redirect to the closest honest Noren page where possible (`/brand/*` → `/about`, `/blog/compute` → `/blog`, old agent and verify detail URLs → their index pages).

## Social cards

Every page except home uses a generated share card at `/og/<page path>.png` (for example `/og/docs/concepts.png`). Pages declare metadata through `pageMetadata()` in `app/_metadata.ts`; docs pages use `buildDocsMetadata()`.

`app/og/[...path]/route.ts` renders the card at request time from the page's declared title and section. The home page uses its rendered share image at `app/opengraph-image.jpg`. Cards are cached and concurrent rendering is bounded; `pnpm build` fails if a page is missing its expected card metadata.

## Design system

Noren uses a light mint ground, forest text, lime actions, Hanken Grotesk display/body type, and JetBrains Mono for code and labels. Shared tokens and components live in:

- `app/globals.css` — colors, controls, cards, motion, and responsive rules
- `app/_brand.tsx` — Noren mark, navigation, interim host constants, and footer data
- `app/SiteHeader.tsx` and `app/SiteFooter.tsx` — shared site frame
- `app/SiteMotion.tsx` — optional, reduced-motion-safe reveal behavior

The Noren marks are `public/noren-mark.svg`, `noren-mark-white.svg`, `noren-mark-mono.svg`, and `noren-mark.png`. Icons and social cards live in `app/`.

## Release checks

Before a public release run:

```sh
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Then verify the deployed apex, docs, and sandbox URLs; exercise the listed public routes and inspect desktop/mobile screenshots. Do not claim on-chain or hosted services are live until they have a real endpoint, contract address, and production verification.
