// The roadmap's content: every track, every item and its state. Items carry a
// state, never a date. An item without a state of its own takes its track's.

export type State = "live" | "progress" | "next" | "planned";

export const STATES: { id: State; label: string; definition: string }[] = [
  { id: "live", label: "Live", definition: "Available today." },
  { id: "progress", label: "In progress", definition: "Being built or set up now." },
  { id: "next", label: "Next", definition: "The next things we plan to ship." },
  { id: "planned", label: "Planned", definition: "Further out, after the items marked Next." },
];

export const STATE_LABEL: Record<State, string> = Object.fromEntries(STATES.map((s) => [s.id, s.label])) as Record<
  State,
  string
>;

export type Item = { name: string; body?: string; state?: State; href?: string };

export type Track = {
  id: string;
  code?: string;
  kicker: string;
  title: string;
  state: State;
  intro: string;
  items: Item[];
};

export const TRACKS: Track[] = [
  {
    id: "foundation",
    code: "M0",
    kicker: "Operating layer",
    title: "Foundation",
    state: "live",
    intro:
      "Noren's operating layer is software on your own machine that lets engineers and researchers build and run autonomous agents within permissions and budgets they set.",
    items: [
      {
        name: "Local daemon",
        body: "Noren runs in the background on your machine, and you control it from the command line, an interactive terminal app, a web console, or a local HTTP gateway.",
      },
      {
        name: "Built-in features",
        body: "Agent identity, permissions, durable memory, an append-only activity log, agent-to-agent messaging, a Model Context Protocol (MCP) bridge, a budget ledger, and local receipts for the resources agents use.",
      },
      {
        name: "Budget limits",
        body: "A process runtime that stops a run as soon as it is projected to overspend its budget or reaches a hard time limit, with optional Linux sandboxing.",
      },
      {
        name: "Signed permissions",
        body: "A signed lifecycle for every permission: grant, scope check, expiry, and revocation.",
      },
      {
        name: "Provenance",
        body: "Verifiable workflow records, and provenance tied to a specific commit for every privileged action.",
      },
      {
        name: "Public sandbox",
        body: "Try Noren at sandbox.usenoren.xyz without installing anything.",
        href: "https://sandbox.usenoren.xyz",
      },
      {
        name: "Live progress",
        body: "Watch an agent work in real time from the command line, the web console, or the HTTP gateway.",
      },
      {
        name: "Isolated code execution",
        body: "Agents write, run, and iterate on real code in a contained environment.",
      },
      {
        name: "Model providers",
        body: "Plug in Anthropic, OpenAI, DeepSeek, or local Ollama once, with automatic local fallback.",
      },
      {
        name: "Save and resume",
        body: "An agent that reaches its resource budget saves its task midway and can resume from there.",
      },
      { name: "Open source", body: "Noren's source code is licensed under Apache 2.0." },
      {
        name: "Solidity contracts written",
        body: "Bond receipt verifier, reputation registry, spend-grant escrow, RWA trade guard and guarded trade executor are written and tested in the repository. They are not deployed under the Noren brand yet.",
      },
      {
        name: "Contracts on Robinhood Chain",
        body: "Deploy and source-verify the contracts on Robinhood Chain (chain id 4663) and publish their addresses here first.",
        state: "next",
      },
      {
        name: "Onchain identity and reputation",
        body: "Record agent identity and audit-derived reputation on Robinhood Chain so anyone can verify an agent's track record.",
        state: "planned",
        href: "/agents",
      },
      {
        name: "Payments in USDG over x402",
        body: "Agents pay per call over x402, an open standard for payments over HTTP, settled in USDG on Robinhood Chain with EIP-3009 signed transfers.",
        state: "planned",
        href: "/robinhood",
      },
      {
        name: "Bounded-spend escrow",
        body: "Agents spend from an onchain grant with a per-call ceiling and a provider allowlist, so the contract holding the funds enforces the limit.",
        state: "planned",
      },
      {
        name: "TypeScript SDK",
        body: "A TypeScript SDK built on viem for the contract calls and x402 payments.",
        state: "planned",
        href: "/sdk",
      },
    ],
  },
  {
    id: "compute",
    kicker: "Compute network",
    title: "Noren Compute",
    state: "planned",
    intro:
      "A planned network where people and their agents rent GPUs and pay for finished work in USDG on Robinhood Chain. Nothing in this track is live.",
    items: [
      {
        name: "GPU rental, paid per use",
        body: "Rent GPU time and pay only for what you use, settled in USDG.",
        href: "/compute",
      },
      {
        name: "Coding agents for hire",
        body: "One operator's agent makes the change in your repository, a different operator runs your acceptance tests, and you pay only for work that passes.",
      },
      {
        name: "Receipts",
        body: "Every payout can be checked onchain, and finished work arrives with a receipt signed by the operator who did it.",
      },
      {
        name: "Staked operators",
        body: "Operators stake before they can take work and lose part of the stake if a fault is proven.",
      },
      {
        name: "Agent access",
        body: "Agents order this work through MCP tools or the command line, with a spending limit on every call.",
      },
      {
        name: "Inference over x402",
        body: "Pay-per-call model inference without an account or a deposit.",
        state: "planned",
      },
    ],
  },
  {
    id: "company",
    kicker: "Organization",
    title: "Company",
    state: "progress",
    intro: "Incorporating Noren and verifying its official account on X.",
    items: [
      { name: "Incorporation", body: "Incorporating Noren as a company." },
      {
        name: "Verified on X",
        body: "Verified Organization status on X, so the gold checkmark lets you tell the official @Noren account from impersonators.",
      },
    ],
  },
  {
    id: "m1",
    code: "M1",
    kicker: "Operating layer",
    title: "Production Readiness, Tools, and Marketplace Groundwork",
    state: "next",
    intro:
      "The next release brings the core tools agents need and the groundwork for a marketplace of agent tools, starting with the plugin catalog.",
    items: [
      {
        name: "Plugin catalog",
        body: "Install vetted tools in one click from inside the web console, starting with filesystem access.",
      },
      { name: "Hardened runtime", body: "Production-grade isolation for untrusted agent code on Linux." },
      { name: "Signed installers", body: "Homebrew, Debian, RPM, and notarized macOS packages." },
      { name: "Stable wire formats", body: "For SDK and integration compatibility." },
      { name: "Browser tool", body: "Agents that navigate, click, and read pages." },
      { name: "Git host integration", body: "Read repositories, comment on issues, and propose pull requests." },
      {
        name: "Replay debugger",
        body: "Pick any moment from the activity log, see the full state, and re-run from there.",
      },
      { name: "Python and Rust SDKs", body: "Published to PyPI and crates.io." },
      { name: "VS Code", body: "Editor integration for Visual Studio Code." },
      { name: "Framework adapters", body: "For LangGraph and CrewAI." },
    ],
  },
  {
    id: "m2",
    code: "M2",
    kicker: "Operating layer",
    title: "Native Integration",
    state: "planned",
    intro: "Deeper integration with the host operating system, on the desktop and on mobile.",
    items: [
      {
        name: "Desktop compositor",
        body: "The first version of Noren's compositor, which shows agents' state, decisions, and results to the person running them, with native Wayland integration on Linux.",
      },
      { name: "Orchestrator agent", body: "An agent that splits a task across other agents and brings their results together." },
      { name: "Memory compaction", body: "Across the working, episodic, and long-term memory tiers." },
      { name: "First-run onboarding", body: "Guided setup the first time you run Noren." },
      { name: "Mobile companion", body: "A read-only companion app." },
    ],
  },
  {
    id: "m3",
    code: "M3",
    kicker: "Operating layer",
    title: "Distributed Operation",
    state: "planned",
    intro: "Multi-host operation, federated identity, and cross-organization workflows.",
    items: [
      { name: "Multi-host teams", body: "Agent teams that work across machines, with agents addressed as name@host.tld." },
      { name: "Agent registry", body: "A public registry with one-line install and signed manifests." },
      { name: "MicroVM isolation", body: "Lightweight virtual machines that keep agent code isolated from the host." },
      { name: "Memory sync", body: "One identity's memory, synchronized across devices." },
      { name: "Agent migration", body: "Move an agent from one host to another." },
      {
        name: "Cross-organization trust",
        body: "Ways for organizations to establish trust with each other when they do business in the marketplace.",
      },
      {
        name: "Cross-chain enforcement",
        body: "Slash a Robinhood Chain bond from an event proven on another EVM chain, with an objective fault definition and a challenge window.",
      },
    ],
  },
  {
    id: "m4",
    code: "M4",
    kicker: "Operating layer",
    title: "1.0 Release",
    state: "planned",
    intro: "A formal commitment to long-term API stability.",
    items: [
      {
        name: "Stable v1 formats",
        body: "The v1 wire formats for IPC, permissions, and agent manifests, covered by the formal commitment to long-term API stability.",
      },
      { name: "Long-term support", body: "A long-term support release line." },
      { name: "Bug bounty", body: "Rewards for security researchers who find and report vulnerabilities in Noren." },
      { name: "Complete documentation", body: "Across all primitives and public APIs." },
      { name: "Conformance suite", body: "For third-party runtimes compatible with Noren." },
    ],
  },
];

const ORDER: State[] = ["live", "progress", "next", "planned"];

export function stateOf(track: Track, item: Item): State {
  return item.state ?? track.state;
}

export function itemId(track: Track, item: Item): string {
  return `${track.id}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/** A track's items in state order (live first), each with its number on the track. */
export function orderedItems(track: Track) {
  return ORDER.flatMap((s) =>
    track.items.flatMap((item, i) => (stateOf(track, item) === s ? [{ item, n: i + 1, state: s }] : [])),
  );
}

/** A track's items grouped by state, in state order; empty groups left out. */
export function groupsOf(track: Track) {
  const items = orderedItems(track);
  return ORDER.map((state) => ({ state, items: items.filter((x) => x.state === state) })).filter(
    (g) => g.items.length > 0,
  );
}

export function countByState(tracks: Track[]): Record<State, number> {
  const counts: Record<State, number> = { live: 0, progress: 0, next: 0, planned: 0 };
  for (const t of tracks) for (const item of t.items) counts[stateOf(t, item)] += 1;
  return counts;
}

/** "16 live · 3 planned" */
export function tally(track: Track): string {
  return groupsOf(track)
    .map((g) => `${g.items.length} ${STATE_LABEL[g.state].toLowerCase()}`)
    .join(" · ");
}
