// Ecosystem inventory for /partners. Single source of truth.
//
// Rule: an entry appears only if it is real today, and its `status` says exactly
// how. "live" = used by the running product. "planned" = designed, not shipped.
// No third-party company is called a partner unless it has agreed to be one;
// everything here is a standard, a network, an asset, or a tool Noren runs on.

export type IntegrationStatus = "live" | "planned";

export type Integration = {
  slug: string;
  name: string;
  by?: string;
  /** One factual sentence: what it is + how Noren uses it. */
  blurb: string;
  status: IntegrationStatus;
  href?: string;
  logo?: string;
};

/** Open standards and the chain Noren speaks. */
export const PROTOCOLS: Integration[] = [
  {
    slug: "x402",
    name: "x402",
    blurb:
      "Agents make capability-scoped, pay-per-call HTTP requests. Noren runs a live x402 gateway and facilitator and has settled a real USDG payment on-chain.",
    status: "live",
    href: "https://www.x402.org",
    logo: "/brands/x402.svg",
  },
  {
    slug: "mcp",
    name: "Model Context Protocol",
    blurb:
      "Noren exposes its tools and agents to any MCP client, and bridges external MCP servers in behind the same permission checks.",
    status: "live",
    href: "https://modelcontextprotocol.io",
    logo: "/brands/mcp.svg",
  },
  {
    slug: "a2a",
    name: "Agent-to-Agent",
    blurb: "Signed task and result envelopes coordinate work across agents over the A2A protocol.",
    status: "live",
  },
  {
    slug: "eip712",
    name: "EIP-712",
    blurb: "Typed, signed payment intents: the payer signs locally, with no RPC call and no transaction.",
    status: "live",
    href: "https://eips.ethereum.org/EIPS/eip-712",
    logo: "/brands/ethereum.svg",
  },
];

/** The network and the money. */
export const CHAIN: Integration[] = [
  {
    slug: "robinhood-chain",
    name: "Robinhood Chain",
    blurb:
      "Chain id 4663. The x402 gateway charges and settles here today. Noren's own escrow contract is built and rehearsed against the live chain, and is not deployed yet.",
    status: "live",
    href: "https://robinhood.com/us/en/agentic-trading/",
    logo: "/brands/robinhood.svg",
  },
  {
    slug: "usdg",
    name: "Global Dollar (USDG)",
    by: "Paxos Digital Singapore",
    blurb:
      "The asset every Noren x402 route is priced in. It supports EIP-3009 authorizations, and Noren's facilitator currently settles it with approve and transferFrom.",
    status: "live",
    href: "https://globaldollar.com",
    logo: "/brands/usdg.png",
  },
];

/** Software Noren runs on or ships with, each checked against the running system. */
export const TOOLS: Integration[] = [
  {
    slug: "hermes",
    name: "Hermes",
    by: "Nous Research",
    blurb: "Noren runs Hermes agents behind a sandboxed, capability-gated coding gateway.",
    status: "live",
    href: "https://github.com/NousResearch/hermes-agent",
    logo: "/partners/hermes.jpg",
  },
  {
    slug: "gvisor",
    name: "gVisor",
    by: "Google",
    blurb:
      "Every workspace run executes under gVisor's user-space kernel: no network, no host files, no inherited secrets. Verified against live runs.",
    status: "live",
    href: "https://gvisor.dev",
  },
  {
    slug: "docker",
    name: "Docker",
    blurb: "Packages the fixed workspace images that the sandbox is allowed to start. Callers never choose an image.",
    status: "live",
    href: "https://www.docker.com",
    logo: "/brands/docker.svg",
  },
  {
    slug: "deepseek",
    name: "DeepSeek",
    blurb:
      "The model behind the sandbox code agent. It writes Python and web files; the isolated workspace, not the model, is the security boundary.",
    status: "live",
    href: "https://www.deepseek.com",
    logo: "/brands/deepseek.svg",
  },
  {
    slug: "cloudflare",
    name: "Cloudflare",
    blurb:
      "Serves the public hosts through tunnels, and Turnstile gates anything that runs code or spends model calls.",
    status: "live",
    href: "https://www.cloudflare.com",
    logo: "/brands/cloudflare.svg",
  },
  {
    slug: "foundry",
    name: "Foundry",
    blurb:
      "Builds and tests the Solidity contracts (89 passing) and rehearses the escrow deployment on a fork of the live chain.",
    status: "live",
    href: "https://getfoundry.sh",
    logo: "/brands/foundry.png",
  },
  {
    slug: "npm",
    name: "npm",
    blurb: "Distribution channel for the Noren packages.",
    status: "live",
    href: "https://www.npmjs.com",
    logo: "/brands/npm.svg",
  },
];

/** Designed but not shipped. Kept visibly separate so nothing reads as live. */
export const PLANNED: Integration[] = [
  {
    slug: "robinhood-orders",
    name: "Robinhood agentic trading",
    by: "Robinhood",
    blurb:
      "Planned: agent orders pass a Noren policy gate before they are placed, and each decision is anchored on-chain once the contracts are live.",
    status: "planned",
    href: "https://robinhood.com/us/en/agentic-trading/",
    logo: "/brands/robinhood.svg",
  },
  {
    slug: "safe",
    name: "Safe",
    blurb:
      "Planned: the escrow admin role is held by a Safe multisig rather than a single key, once roles are chosen.",
    status: "planned",
    href: "https://safe.global",
  },
];

// Kept for the pages that still import the old name.
export const PARTNERS: Integration[] = [...TOOLS, ...PLANNED];

/** Avatars committed at public/partners/<slug>.jpg. */
const LOGO_SLUGS = new Set<string>(["hermes"]);

export function logoFor(slug: string): string | undefined {
  return LOGO_SLUGS.has(slug) ? `/partners/${slug}.jpg` : undefined;
}

// Avatars drawn on a white tile need no inversion on the light mint theme.
export function logoOnLightTile(_slug: string): boolean {
  return false;
}
