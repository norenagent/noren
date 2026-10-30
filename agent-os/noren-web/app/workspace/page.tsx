"use client";

import { useState } from "react";
import { api, type AgentCodeResult, type WorkspaceRun } from "@/lib/api";
import { friendlyError, Tile } from "@/lib/ui";
import { PageHeader } from "../components/PageHeader";
import { buildPreviewDocument } from "@/lib/preview";
import { Turnstile, turnstileEnabled } from "../components/Turnstile";

const GUARANTEES = [
  "Runs under gVisor: a user-space kernel sits between code and the host",
  "No network, no host files, no secrets, no environment inherited",
  "Unprivileged user with limits: 1 CPU, 128 MB memory, 32 processes, 8 MB disk, 10 s",
  "The folder is deleted afterwards; only file names and sizes are returned",
];

const STARTER = `# Python 3.12 · standard library only · no network
import json, hashlib

data = {"hello": "noren", "sum": sum(range(10))}
print(json.dumps(data))
print(hashlib.sha256(json.dumps(data).encode()).hexdigest())

with open("/workspace/result.json", "w") as f:
    json.dump(data, f)
`;

const AGENT_EXAMPLES = [
  "Build a one-page landing site for a coffee shop called Ember with a hero, a menu and a footer",
  "Write a function that reverses the words in a sentence, with tests",
  "Implement a small LRU cache class with tests",
];

/** Save the agent's files as a zip-free bundle: one download per file is noisy, so
 *  offer the single page when there is one, else the main solution file. */
function downloadText(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

type Mode = "run" | "agent";

export default function WorkspacePage() {
  const [mode, setMode] = useState<Mode>("run");
  const [run, setRun] = useState<WorkspaceRun | null>(null);
  const [agent, setAgent] = useState<AgentCodeResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "starter" | "python" | "agent">("");
  const [source, setSource] = useState(STARTER);
  const [task, setTask] = useState(AGENT_EXAMPLES[0]);
  const [token, setToken] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setToken(null);
    setError("");
  }

  async function exec(kind: "starter" | "python" | "agent") {
    setBusy(kind);
    setError("");
    try {
      if (kind === "agent") {
        setAgent(await api.runAgentCode(task, token ?? undefined));
      } else {
        setRun(
          kind === "starter"
            ? await api.runWebStarter()
            : await api.runPython(source, token ?? undefined),
        );
      }
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : "Workspace run failed"));
    } finally {
      setBusy("");
      if (kind !== "starter") window.__covTurnstileReset?.();
    }
  }

  const preview = agent ? buildPreviewDocument(agent.files) : null;
  const totalBytes = run?.artifacts.reduce((sum, a) => sum + a.bytes, 0) ?? 0;
  const sourceBytes = new TextEncoder().encode(source).length;
  const tooBig = sourceBytes > 16 * 1024;
  const needsVerify = turnstileEnabled && !token;

  return (
    <>
      <PageHeader
        eyebrow="Agent workspace"
        title="Workspace"
        subhead="Run code in an isolated, writable, throwaway workspace, or let an agent write and test it for you. The sandbox owns the image, command and limits."
        right={
          <button className="btn" onClick={() => exec("starter")} disabled={busy !== ""}>
            {busy === "starter" ? "Running…" : "Run web starter"}
          </button>
        }
      />

      <section className="panel">
        <header className="panel-head">
          <div>
            <p className="eyebrow">Isolation</p>
            <h2>What a workspace can and cannot do</h2>
          </div>
        </header>
        <ul>
          {GUARANTEES.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </section>

      <div role="tablist" aria-label="Workspace mode" style={{ display: "flex", gap: 8 }}>
        <button
          role="tab"
          aria-selected={mode === "run"}
          className={mode === "run" ? "btn primary" : "btn"}
          onClick={() => switchMode("run")}
        >
          Run my code
        </button>
        <button
          role="tab"
          aria-selected={mode === "agent"}
          className={mode === "agent" ? "btn primary" : "btn"}
          onClick={() => switchMode("agent")}
        >
          Ask the agent
        </button>
      </div>

      {mode === "run" && (
        <section className="panel">
          <header className="panel-head">
            <div>
              <p className="eyebrow">Python</p>
              <h2>Run your own code</h2>
            </div>
          </header>
          <textarea
            aria-label="Python source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            rows={12}
            style={{ width: "100%", fontFamily: "var(--mono, monospace)", fontSize: 13 }}
          />
          <p>
            {fmtBytes(sourceBytes)} of 16 KB
            {tooBig ? " — too large" : ""}. Your code is saved nowhere; the audit log keeps only a
            hash.
          </p>
          {turnstileEnabled && <Turnstile key="ts-run" onToken={setToken} />}
          <button
            className="btn primary"
            onClick={() => exec("python")}
            disabled={busy !== "" || tooBig || sourceBytes === 0 || needsVerify}
          >
            {busy === "python" ? "Running…" : "Run Python"}
          </button>
          {!turnstileEnabled && (
            <p>Code runs are switched off on this deployment until human verification is configured.</p>
          )}
        </section>
      )}

      {mode === "agent" && (
        <section className="panel">
          <header className="panel-head">
            <div>
              <p className="eyebrow">Code agent</p>
              <h2>Describe a small program</h2>
            </div>
          </header>
          <p>
            The agent writes Python and its tests, runs them in the workspace above, reads the
            failures and fixes its own code, up to 4 rounds. It never gets a shell and cannot reach
            the network. Limit: 5 tasks per day.
          </p>
          <textarea
            aria-label="Task for the code agent"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            maxLength={600}
            rows={3}
            style={{ width: "100%" }}
          />
          <p>{task.length} of 600 characters. Or start from an example:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
            {AGENT_EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="btn link"
                onClick={() => setTask(ex)}
                type="button"
                style={{
                  whiteSpace: "normal",
                  textAlign: "left",
                  height: "auto",
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                }}
              >
                {ex}
              </button>
            ))}
          </div>
          {turnstileEnabled && <Turnstile key="ts-agent" onToken={setToken} />}
          <button
            className="btn primary"
            onClick={() => exec("agent")}
            disabled={busy !== "" || task.trim().length === 0 || needsVerify}
          >
            {busy === "agent" ? "Agent is working… this can take a minute" : "Run agent"}
          </button>
        </section>
      )}

      {error && (
        <section className="panel" role="alert">
          <p>{error}</p>
        </section>
      )}

      {mode === "agent" && agent && (
        <>
          <section className="metrics">
            <Tile label="Result" value={agent.status.replace("_", " ")} small />
            <Tile label="Rounds used" value={agent.rounds.length} />
            <Tile label="Files" value={agent.files.length} />
          </section>
          {agent.message && (
            <section className="panel" role="status">
              <p>{agent.message}</p>
            </section>
          )}
          {agent.rounds.map((r) => (
            <section className="panel" key={r.round}>
              <header className="panel-head">
                <div>
                  <p className="eyebrow">Round {r.round}</p>
                  <h2>{r.passed ? "Tests passed" : "Tests failed"}</h2>
                </div>
              </header>
              {r.stdout && (
                <>
                  <p className="eyebrow">Program output</p>
                  <pre>{r.stdout}</pre>
                </>
              )}
              <p className="eyebrow">Test report</p>
              <pre>{r.stderr || "(the tests printed nothing)"}</pre>
            </section>
          ))}
          {preview && (
            <section className="panel">
              <header className="panel-head">
                <div>
                  <p className="eyebrow">Preview</p>
                  <h2>Your site, as the agent built it</h2>
                </div>
              </header>
              <p>
                Shown in a locked-down frame: it cannot make network requests, read cookies or touch
                this page.
              </p>
              <iframe
                title="Site preview"
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                srcDoc={preview}
                style={{ width: "100%", height: 460, border: "1px solid var(--line, #ddd)", borderRadius: 8, background: "#fff" }}
              />
            </section>
          )}
          {agent.files.map((f) => (
            <section className="panel" key={f.name}>
              <header className="panel-head">
                <div>
                  <p className="eyebrow">Final file</p>
                  <h2>{f.name}</h2>
                </div>
                <button className="btn" type="button" onClick={() => downloadText(f.name, f.content)}>
                  Download
                </button>
              </header>
              <pre>{f.content}</pre>
            </section>
          ))}
        </>
      )}

      {mode === "run" && run && (
        <>
          <section className="metrics">
            <Tile label="Preset" value={run.preset} small />
            <Tile label="Files written" value={run.artifacts.length} />
            <Tile label="Total size" value={fmtBytes(totalBytes)} small />
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <p className="eyebrow">Output</p>
                <h2>Logs</h2>
              </div>
            </header>
            <pre>
              {run.stdout || "(no output)"}
              {run.stdout_truncated ? "\n[stdout truncated]" : ""}
              {run.stderr ? `\n${run.stderr}` : ""}
              {run.stderr_truncated ? "\n[stderr truncated]" : ""}
            </pre>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <p className="eyebrow">Artifacts</p>
                <h2>
                  Files <span className="count">{run.artifacts.length}</span>
                </h2>
              </div>
            </header>
            <ul>
              {run.artifacts.map((a) => (
                <li key={a.path}>
                  <code>{a.path}</code> · {fmtBytes(a.bytes)}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
