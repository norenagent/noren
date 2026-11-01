export interface NorenBrandMetadata {
  name: string;
  shortName: string;
  slug: string;
  npmScope: string;
  tagline: string;
  networkTagline: string;
  siteUrl: string;
  portalUrl: string;
  docsUrl: string;
  analyticsUrl: string;
  repoUrl: string;
  securityEmail: string;
  socialHandle: string;
  cookies: {
    session: string;
    nonce: string;
  };
  token: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const norenBrand: Readonly<NorenBrandMetadata>;
export function resolveSiteUrl(input?: string): string;
export function resolveBrandMetadata(overrides?: Partial<NorenBrandMetadata>): NorenBrandMetadata;
