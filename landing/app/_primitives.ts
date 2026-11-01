export type Primitive = {
  slug: string;
  term: string;
  gloss: string; // one short atomic-answer sentence
  definition: string; // 1–2 sentence DefinedTerm description
  docHref: string; // canonical docs URL
};

// Condensed strictly from app/docs/primitives/page.tsx, no invented facts,
// strict "X is a Y that Z" lead form for clean AI extraction. Shared by the
// glossary page and any future home/FAQ content so definitions never drift.
export const PRIMITIVES: Primitive[] = [
  {
    slug: "intent",
    term: "Intent",
    gloss:
      "A natural-language request addressed to the daemon and routed to an agent that can fulfil it.",
    definition:
      "An intent is a natural-language request addressed to the Noren daemon. It carries a stable UUID, an issuer AgentId, a timestamp, a priority, and an optional parent, and is routed by keyword overlap with a deterministic echo fallback.",
    docHref: "https://docs.usenoren.xyz/architecture",
  },
  {
    slug: "runtime",
    term: "Runtime",
    gloss: "The mechanism that executes an agent under a resource budget.",
    definition:
      "The runtime is the mechanism that executes an agent. Today it spawns each agent as a child process exchanging JSON over stdin/stdout under a wall-clock budget with hard preemption, behind a small trait designed to back stricter isolation such as gVisor or Firecracker.",
    docHref: "https://docs.usenoren.xyz/primitives",
  },
  {
    slug: "memory",
    term: "Memory",
    gloss:
      "A three-tier semantic store with cosine-similarity search over embedded vectors.",
    definition:
      "Memory is a three-tier semantic store (working, episodic, and long-term) with cosine-similarity search over embedded vectors. Records are SQLite-backed in production and carry a UUID, tier, owner, result text, embedding, metadata, and timestamp.",
    docHref: "https://docs.usenoren.xyz/memory",
  },
  {
    slug: "identity",
    term: "Identity",
    gloss:
      "A single ed25519 keypair per install that signs grants, settlement, and audit issuance.",
    definition:
      "Identity is a single ed25519 keypair per Noren install. The same key signs capability grants, signs Robinhood Chain settlement transactions, and appears as the daemon's issuer on audit events and memory records.",
    docHref: "https://docs.usenoren.xyz/identity",
  },
  {
    slug: "permissions",
    term: "Permissions",
    gloss:
      "ed25519-signed capability tokens naming a dotted action and optional JSON scope.",
    definition:
      "Permissions are capability tokens. Each token names a dotted action from a reserved namespace and an optional JSON scope, is signed with ed25519 over a deterministic encoding, and is enforced at dispatch and audited regardless of outcome.",
    docHref: "https://docs.usenoren.xyz/capabilities",
  },
  {
    slug: "comms",
    term: "Comms",
    gloss:
      "How agents and clients talk to the daemon, to each other, and to external tools.",
    definition:
      "Comms is how agents and clients communicate with the daemon and one another. Three transports exist today: local IPC over a Unix socket, an HTTP gateway on 127.0.0.1:8421, and MCP and A2A adapters for tools and agent-to-agent traffic.",
    docHref: "https://docs.usenoren.xyz/ipc",
  },
  {
    slug: "compositor",
    term: "Compositor",
    gloss:
      "How agent state, decisions, and results are surfaced back to a human operator.",
    definition:
      "The compositor is how agent state, decisions, and results are surfaced to a human operator. It covers the operator console, this public landing and documentation surface, and the noren-tui terminal binary, all reading the same daemon with no privileged shortcut around the IPC and HTTP surfaces.",
    docHref: "https://docs.usenoren.xyz/architecture",
  },
  {
    slug: "settlement",
    term: "Settlement",
    gloss: "How resource consumption is accounted for, with on-chain settlement on Robinhood Chain (coming soon).",
    definition:
      "Settlement is how resource consumption is accounted for. Noren records local SettlementReceipt rows today; the Robinhood Chain settlement contracts are written but not deployed yet, so the on-chain fields stay empty until they are.",
    docHref: "https://docs.usenoren.xyz/settlement",
  },
  {
    slug: "audit",
    term: "Audit",
    gloss:
      "The cross-cutting evidence layer beneath identity, permissions, and settlement.",
    definition:
      "Audit is the evidence layer that underlies identity, permissions, and settlement rather than a standalone primitive. Audit events are append-only JSONL rows with structured kinds, issuers, timestamps, and local hash-chain integrity reports.",
    docHref: "https://docs.usenoren.xyz/audit",
  },
];
