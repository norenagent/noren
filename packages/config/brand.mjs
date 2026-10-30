const DEFAULT_SITE_URL = 'https://usenoren.xyz';
const DEFAULT_DOCS_URL = 'https://docs.usenoren.xyz';
const DEFAULT_ANALYTICS_URL = 'https://analytics.usenoren.xyz';
const DEFAULT_REPO_URL = 'https://github.com/norenagent/noren';
const DEFAULT_SECURITY_EMAIL = 'https://usenoren.xyz/contact';

function toNumber(raw, fallback) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const norenBrand = Object.freeze({
  name: 'Noren Protocol',
  shortName: 'Noren',
  slug: 'noren',
  npmScope: '@noren',
  tagline: 'Robinhood Chain-native agent coordination, settlement, and provenance.',
  networkTagline: 'Agent-native operating infrastructure with USDG credits and receipt anchoring on Robinhood Chain.',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NOREN_SITE_URL ?? DEFAULT_SITE_URL,
  portalUrl: process.env.NEXT_PUBLIC_PORTAL_URL ?? process.env.NOREN_PORTAL_URL ?? DEFAULT_SITE_URL,
  docsUrl: process.env.NEXT_PUBLIC_DOCS_URL ?? process.env.NOREN_DOCS_URL ?? DEFAULT_DOCS_URL,
  analyticsUrl:
    process.env.NEXT_PUBLIC_ANALYTICS_URL ?? process.env.NOREN_ANALYTICS_URL ?? DEFAULT_ANALYTICS_URL,
  repoUrl: process.env.NOREN_REPO_URL ?? DEFAULT_REPO_URL,
  securityEmail: process.env.NOREN_SECURITY_EMAIL ?? DEFAULT_SECURITY_EMAIL,
  socialHandle: process.env.NEXT_PUBLIC_NOREN_X_HANDLE ?? '@noren',
  cookies: Object.freeze({
    session: 'noren_session',
    nonce: 'noren_nonce',
  }),
  token: Object.freeze({
    name: process.env.NEXT_PUBLIC_NOREN_TOKEN_NAME ?? process.env.NOREN_TOKEN_NAME ?? 'Noren Token',
    symbol: process.env.NEXT_PUBLIC_NOREN_TOKEN_SYMBOL ?? process.env.NOREN_TOKEN_SYMBOL ?? 'NOREN',
    decimals: toNumber(
      process.env.NEXT_PUBLIC_NOREN_TOKEN_DECIMALS ?? process.env.NOREN_TOKEN_DECIMALS,
      6,
    ),
  }),
});

export function resolveSiteUrl(input) {
  if (!input) return norenBrand.siteUrl;
  try {
    return new URL(input).toString().replace(/\/$/, '');
  } catch {
    return norenBrand.siteUrl;
  }
}

export function resolveBrandMetadata(overrides = {}) {
  return {
    ...norenBrand,
    ...overrides,
    token: {
      ...norenBrand.token,
      ...(overrides.token ?? {}),
    },
    cookies: {
      ...norenBrand.cookies,
      ...(overrides.cookies ?? {}),
    },
  };
}
