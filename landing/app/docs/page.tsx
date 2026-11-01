import Link from "next/link";
import { buildDocsMetadata, buildDocsJsonLd } from "./_meta";

const META_ARGS = ["", "Overview", 'Noren is an open, agent-native operating layer. The documentation covers concepts, architecture, reference, protocols, and operations.'] as const;
export const metadata = buildDocsMetadata(...META_ARGS);

const TILES = [
  {
    href: "/getting-started",
    title: "Getting started",
    body: "Install the daemon, register an agent, and dispatch a first intent.",
  },
  {
    href: "/concepts",
    title: "Concepts",
    body: "Intents, agents, capabilities, memory, audit, and settlement.",
  },
  {
    href: "/autonomy",
    title: "Autonomous workflow",
    body: "Task lifecycle, continuation, validation gates, and sprint summaries.",
  },
  {
    href: "/validation",
    title: "Validation profile",
    body: "Operating surfaces, evidence requirements, and live boundary checks.",
  },
  {
    href: "/alpha-release",
    title: "Alpha release contract",
    body: "Source-alpha boundary, evidence bundle requirements, and human-owned release decisions.",
  },
  {
    href: "/architecture",
    title: "Architecture",
    body: "Architecture of the daemon, runtime, local control plane, and the planned Robinhood Chain settlement contracts.",
  },
  {
    href: "/cli",
    title: "Command-line interface",
    body: "Reference for every noren subcommand, including arguments and exit codes.",
  },
  {
    href: "/http-api",
    title: "HTTP API",
    body: "Routes, request schemas, and response shapes for the local HTTP gateway.",
  },
  {
    href: "/agent-manifest",
    title: "Agent manifest",
    body: "Schema, runtime contract, and validation rules for the agent.toml manifest.",
  },
  {
    href: "/capabilities",
    title: "Capability tokens",
    body: "ed25519-signed permission tokens: structure, canonical encoding, verification, and revocation.",
  },
  {
    href: "/mcp",
    title: "MCP integration",
    body: "The Tool trait, native tools, and integration with external MCP servers over JSON-RPC.",
  },
  {
    href: "/security",
    title: "Security model",
    body: "Trust boundaries, threat model, defaults, and operator responsibilities.",
  },
  {
    href: "/multichain",
    title: "Robinhood Chain",
    body: "Settlement on Robinhood Chain (chain id 4663) in USDG: signed trust data verified with ecrecover, and the EVM contracts in the repository. Coming soon.",
  },
  {
    href: "/provenance",
    title: "Provenance",
    body: "Commit-scoped envelopes for autonomy tasks, changed file evidence, and validation records.",
  },
  {
    href: "/live-coverage",
    title: "Live coverage",
    body: "Opt-in real-boundary test inventory across daemon, CLI, A2A, MCP, runtime, and model surfaces.",
  },
  {
    href: "/gvisor-live-runner",
    title: "Linux gVisor runner",
    body: "Repeatable Linux host setup for the opt-in runsc sandbox validation path.",
  },
];

export default function DocsIndexPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildDocsJsonLd(...META_ARGS)) }}
      />
      <h1>Documentation</h1>
      <p>
        Noren is an open, agent-native operating layer. It runs locally on
        the host and exposes eight operating-layer primitives (intent,
        runtime, memory, identity, permissions, comms, compositor, and
        settlement) through which human users, software agents, and tools
        coordinate work, share state, and settle usage.
      </p>

      <p>
        The documentation is organized into concepts, architecture, reference,
        protocols, and operations. The{" "}
        <Link href="/getting-started">Getting started</Link> guide covers
        installation and an end-to-end intent dispatch;{" "}
        <Link href="/concepts">Concepts</Link> establishes the model referenced
        throughout the remainder of the documentation.
      </p>

      <h2>Browse by area</h2>

      <div className="not-prose mt-6 grid gap-3 sm:grid-cols-2">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group block rounded-md border border-line/80 bg-raised p-5 transition-colors hover:border-line-strong hover:bg-raised"
          >
            <div className="text-[15px] font-medium text-fg group-hover:text-fg">
              {t.title}
            </div>
            <div className="mt-2 text-[13px] leading-relaxed text-muted">
              {t.body}
            </div>
          </Link>
        ))}
      </div>

      <h2>Status</h2>
      <p>
        Noren is pre-1.0 systems infrastructure. The local daemon, CLI,
        TUI, identity, permissions, memory, audit, peer auth, budget, and
        local receipt ledger are implemented in the repository. MCP, A2A, the local web
        console, autonomous workflow records, live coverage matrix, and
        provenance envelopes are actively hardening. Runtime isolation includes
        manifest-level requirements, trusted-local fail-closed behavior,
        daemon-selectable Linux gVisor configuration, runtime-level gVisor
        runner work, live Linux sandbox coverage, and a documented Linux runner
        setup. Noren&apos;s settlement chain is Robinhood Chain (chain id 4663,
        USDG, ETH for gas). Solidity contracts (escrow, bond-receipt and
        reputation verifiers, trade guards) exist in the repository with
        Foundry tests, but <strong>nothing is deployed on-chain yet</strong>;
        deployment is coming soon. The Noren token contract is deployed (see the token page). A separate x402 gateway
        and facilitator for USDG is already live at gateway.usenoren.xyz.
        Distributed settlement, cross-chain
        enforcement, installers, additional-language SDK
        publication (Python and Rust-crate), release-scope and audit-root
        signing, and transparency publication are
        tracked on <a href="https://usenoren.xyz/roadmap">the roadmap</a>.
      </p>

      <p>Source repository: coming soon.</p>

      <h2>Position in the stack</h2>
      <p>
        Noren operates between the host operating system and user-facing
        agentic applications. It provides identity, permissions, memory,
        communication, and settlement as shared, host-level services, allowing
        language models, agent frameworks, and end-user applications to
        integrate against a common substrate rather than reimplement these
        primitives independently.
      </p>
    </>
  );
}
