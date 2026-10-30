import Link from "next/link";
import { buildDocsMetadata, buildDocsJsonLd } from "../_meta";

const META_ARGS = ["getting-started", "Getting started", 'Install Noren from source, run the daemon, and submit your first intent.'] as const;
export const metadata = buildDocsMetadata(...META_ARGS);

export default function GettingStartedPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildDocsJsonLd(...META_ARGS)) }}
      />
      <h1>Getting started</h1>
      <p>
        This guide installs Noren from source, brings up the daemon, and
        dispatches a first intent end-to-end. The full loop runs on the
        local host without external accounts or credentials.
      </p>

      <h2>Prerequisites</h2>

      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>Version</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>rustc</code> / <code>cargo</code>
            </td>
            <td>stable (1.80+)</td>
            <td>Builds the daemon, the CLI, and every workspace crate.</td>
          </tr>
          <tr>
            <td>Node.js</td>
            <td>22+</td>
            <td>Optional; required only to run the landing site locally.</td>
          </tr>
          <tr>
            <td>pnpm</td>
            <td>10+</td>
            <td>Optional; same as Node.js.</td>
          </tr>
          <tr>
            <td>Foundry (<code>forge</code>)</td>
            <td>stable</td>
            <td>
              Optional; required only to build and test the Solidity
              contracts under <code>agent-os/evm</code> for Robinhood Chain.
              Nothing is deployed yet (coming soon).
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Build from source</h2>

      <p>Source repository: coming soon. From the source tree:</p>

      <pre>
        <code>{`cd agent-os
cargo build --workspace`}</code>
      </pre>

      <p>
        The Rust workspace lives under <code>agent-os/</code>; running{" "}
        <code>cargo</code> from the repository root fails because no{" "}
        <code>Cargo.toml</code> sits there. The first build downloads
        dependencies and may take a few minutes. Three binaries land under{" "}
        <code>agent-os/target/debug/</code>:
      </p>

      <ul>
        <li>
          <code>norend</code>: the daemon. Long-running. Listens on a
          Unix socket and an HTTP gateway.
        </li>
        <li>
          <code>noren</code>: the command-line client. Speaks to the
          daemon over the Unix socket.
        </li>
        <li>
          <code>noren-tui</code>: the terminal UI client. Renders
          intent, memory, audit, capabilities, A2A, chain-receipts, and
          peer-registry views over the same Unix socket.
        </li>
      </ul>

      <h2>Configure</h2>

      <p>
        Noren looks for its state under <code>$NOREN_HOME</code> (default{" "}
        <code>~/.noren</code>). The directory is created on first
        daemon start; you can pre-create it to drop in a configuration file:
      </p>

      <pre>
        <code>{`mkdir -p ~/.noren`}</code>
      </pre>

      <p>
        Configuration lives in{" "}
        <code>~/.noren/secrets.toml</code>. A minimal example pointing at
        a local Ollama instance:
      </p>

      <pre>
        <code>{`[llm]
provider = "ollama"
model    = "qwen2.5:7b"

[embed]
provider = "ollama"
model    = "nomic-embed-text"
`}</code>
      </pre>

      <p>
        In the absence of this file, Noren defaults to a mock LLM and a
        mock search provider; the research agent will return placeholder
        text under that configuration. Refer to{" "}
        <Link href="/concepts">Concepts</Link> and{" "}
        <Link href="/agent-manifest">Agent manifest</Link> for the full
        configuration surface.
      </p>

      <h2>Run the daemon</h2>

      <pre>
        <code>{`./target/debug/norend`}</code>
      </pre>

      <p>The daemon initialises itself on first run:</p>

      <ul>
        <li>
          Generates an ed25519 identity at{" "}
          <code>$NOREN_HOME/identity/local.key</code> with mode{" "}
          <code>0600</code>.
        </li>
        <li>
          Opens a Unix socket at <code>$NOREN_HOME/sock</code>.
        </li>
        <li>
          Binds an HTTP gateway on <code>127.0.0.1:8421</code>.
        </li>
        <li>
          Opens the SQLite memory store at{" "}
          <code>$NOREN_HOME/memory.db</code>.
        </li>
        <li>
          Loads each agent package under{" "}
          <code>$NOREN_HOME/agents/</code>, every subdirectory
          containing an <code>agent.toml</code>; flat{" "}
          <code>*.toml</code> files at the top of{" "}
          <code>agents/</code> are silently skipped.
        </li>
      </ul>

      <h2>Submit a first intent</h2>

      <p>From a second terminal session:</p>

      <pre>
        <code>{`./target/debug/noren ping
# → pong

./target/debug/noren intent "summarise recent work on agent memory"`}</code>
      </pre>

      <p>
        With no agents registered, the daemon returns a deterministic echo
        response and persists a working-tier memory record alongside a
        settlement receipt. Inspect both:
      </p>

      <pre>
        <code>{`./target/debug/noren memory recent
./target/debug/noren receipts recent --json`}</code>
      </pre>

      <h2>Register an agent</h2>

      <p>
        Each agent is a package directory under{" "}
        <code>$NOREN_HOME/agents/</code> containing an{" "}
        <code>agent.toml</code> manifest. The router walks the{" "}
        <code>agents/</code> directory, picks up each subdirectory&apos;s{" "}
        <code>agent.toml</code>, and resolves <code>entry</code>{" "}
        against the package directory. Flat manifest files at the top
        of <code>agents/</code> are silently skipped. The repository
        ships a <code>research</code> agent at{" "}
        <code>agent-os/agents/research</code>; build it and stage the
        binary alongside an <code>agent.toml</code> so the relative
        entry path resolves:
      </p>

      <pre>
        <code>{`cargo build -p research-agent --release

mkdir -p ~/.noren/agents/research
cp agent-os/target/release/research ~/.noren/agents/research/

cat > ~/.noren/agents/research/agent.toml <<'EOF'
[agent]
id      = "research"
name    = "research"
version = "0.1.0"
runtime = "rust-bin"
entry   = "research"

[capabilities]
required = ["tool.web_search"]

[resources]
cpu_ms_per_task = 30000
memory_mb       = 512
disk_mb         = 100
network         = "outbound-https-only"
EOF`}</code>
      </pre>

      <p>
        Restart the daemon, grant the required capability, and submit an
        intent that matches the agent&apos;s registered keywords:
      </p>

      <pre>
        <code>{`./target/debug/noren capabilities grant tool.web_search
./target/debug/noren intent "search for recent papers on agent memory"`}</code>
      </pre>

      <p>
        The daemon routes the intent to the <code>research</code> agent,
        executes the binary as a subprocess, captures the response,
        persists the memory record and settlement receipt, and emits audit
        events for both the dispatch and the capability check.
      </p>

      <h2>Verify local state</h2>

      <p>Each primitive&apos;s recent state is queryable through the CLI:</p>

      <pre>
        <code>{`noren memory recent --limit 20
noren chain status --json
noren receipts recent --limit 20 --json
noren chain flush-receipts --limit 20 --json
noren chain receipt-batches --limit 20 --json
noren capabilities recent --limit 20 --json
noren capabilities purge --older-than-ms 2592000000 --json
noren verify --window 100 --json`}</code>
      </pre>

      <p>
        <code>noren verify</code> cross-checks the audit log against the
        memory store, capability ledger, and settlement receipts and
        reports any drift.
      </p>

      <h2>Optional: build the EVM contracts</h2>

      <p>
        The settlement contracts for Robinhood Chain (chain id 4663) are
        Solidity sources with Foundry tests. They are not deployed; this only
        builds and tests them locally:
      </p>

      <pre>
        <code>{`cd agent-os/evm
forge build
forge test`}</code>
      </pre>

      <h2>Further reading</h2>

      <ul>
        <li>
          <Link href="/concepts">Concepts</Link>. Data model: intents,
          agents, capabilities, memory, audit, and settlement.
        </li>
        <li>
          <Link href="/cli">CLI reference</Link>. Complete subcommand
          reference.
        </li>
        <li>
          <Link href="/http-api">HTTP API</Link>. Gateway routes for
          browser-facing UIs and third-party integrations.
        </li>
        <li>
          <Link href="/agent-manifest">Agent manifest</Link>. Full{" "}
          <code>agent.toml</code> schema.
        </li>
        <li>
          <Link href="/security">Security model</Link>. Trust
          boundaries and operator responsibilities.
        </li>
      </ul>
    </>
  );
}
