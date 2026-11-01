import type { NextConfig } from "next";

// Next.js dev (Turbopack) + React rely on eval() for HMR and debugging. Allow it
// only in development; production CSP stays strict (no unsafe-eval).
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Any https image (partner/token logos); images cannot execute.
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
      // Docs + sibling subdomains, and Robinhood Chain RPC reads.
      "connect-src 'self' https://docs.usenoren.xyz https://*.usenoren.xyz https://*.norenx402.com https://rpc.mainnet.chain.robinhood.com https://cloudflareinsights.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Turbopack's on-disk dev cache grew to 2.2 GB within a day, and dev
    // servers started on it spawned PostCSS workers until the machine ran out
    // of memory. A cold start costs well under a second per page.
    turbopackFileSystemCacheForDev: false,
  },
  async redirects() {
    // Retired Noren-era content has a useful Noren destination instead of a
    // dead link. Dynamic routes were removed with their public data sources.
    return [
      { source: "/brand", destination: "/about", permanent: true },
      { source: "/brand/:path*", destination: "/about", permanent: true },
      { source: "/blog/inference-receipts", destination: "/blog", permanent: true },
      { source: "/noren-compute", destination: "/blog", permanent: true },
      { source: "/blog/compute", destination: "/blog", permanent: true },
      { source: "/agents/:asset", destination: "/agents", permanent: true },
      { source: "/verify/:sha", destination: "/verify", permanent: true },
    ];
  },
  productionBrowserSourceMaps: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [320, 640, 1280],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [
      {
        source: "/(logo|logomark).svg",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/(sitemap.xml|docs/sitemap.xml)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
      { source: "/:path*", headers: securityHeaders },

    ];
  },
};

export default config;
