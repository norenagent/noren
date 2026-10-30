"use client";

import { useState } from "react";
import { api, type AgentCodeResult, type WorkspaceRun } from "@/lib/api";
import { friendlyError, Tile } from "@/lib/ui";
import { buildPreviewDocument } from "@/lib/preview";
import { Turnstile, turnstileEnabled } from "../components/Turnstile";

const GUARANTEES = [
  "Runs under gVisor: a user-space kernel sits between code and the host",
  "No network, no host files, no secrets, no environment inherited",
  "Unprivileged user with limits: 1 CPU, 128 MB memory, 32 processes, 8 MB disk, 10 s",
  "The folder is deleted afterwards; only file names and sizes are returned",
];

const FACTS = ["gVisor kernel", "No network", "1 CPU · 128 MB · 10 s", "Deleted afterwards"];

const STARTER = `# Python 3.12 · standard library only · no network
import json, hashlib

data = {"hello": "noren", "sum": sum(range(10))}
print(json.dumps(data))
print(hashlib.sha256(json.dumps(data).encode()).hexdigest())

with open("/workspace/result.json", "w") as f:
    json.dump(data, f)
`;

const AGENT_EXAMPLES: { icon: string; text: string }[] = [
  { icon: "web", text: "Build a one-page landing site for a coffee shop called Ember with a hero, a menu and a footer" },
  { icon: "fn", text: "Write a function that reverses the words in a sentence, with tests" },
  { icon: "cache", text: "Implement a small LRU cache class with tests" },
];

function Icon({ name }: { name: string }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "web") return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18" /><path d="M7 6.5h.01M10 6.5h.01" /></svg>;
  if (name === "fn") return <svg {...p}><path d="m8 7-5 5 5 5" /><path d="m16 7 5 5-5 5" /><path d="m13.5 5-3 14" /></svg>;
  if (name === "cache") return <svg {...p}><rect x="4" y="4" width="16" height="6" rx="2" /><rect x="4" y="14" width="16" height="6" rx="2" /><path d="M8 7h.01M8 17h.01" /></svg>;
  if (name === "play") return <svg {...p}><path d="M7 5v14l11-7z" /></svg>;
  if (name === "file") return <svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>;
  return <svg {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
}

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
  const [mode, setMode] = useState<Mode>("agent");
  const [run, setRun] = useState<WorkspaceRun | null>(null);
  const [agent, setAgent] = useState<AgentCodeResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "starter" | "python" | "agent">("");
  const [source, setSource] = useState(STARTER);
  const [task, setTask] = useState("");
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
        setRun(null);
        setAgent(await api.runAgentCode(task, token ?? undefined));
      } else {
        setAgent(null);
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
  const agentReady = task.trim().length > 0;
  const submit = () => (mode === "agent" ? exec("agent") : exec("python"));
  const canSubmit =
    busy === "" && !needsVerify && (mode === "agent" ? agentReady : !tooBig && sourceBytes > 0);

  return (
    <>
      <section className="ws-hero">
        <p className="eyebrow">Agent workspace</p>
        <h1>What should run in the sandbox?</h1>
        <p className="ws-sub">
          Describe a small program and an agent writes it, tests it and fixes it. Or run your own
          Python. Either way it runs in a throwaway workspace that is deleted afterwards.
        </p>

        <div className="ws-composer">
          {mode === "agent" ? (
            <textarea
              aria-label="Task for the code agent"
              className="ws-input"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) submit();
              }}
              maxLength={600}
              rows={3}
              placeholder="Describe a small program, for example a landing page or a function with tests"
            />
          ) : (
            <textarea
              aria-label="Python source"
              className="ws-input ws-code"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              rows={11}
            />
          )}

          <div className="ws-bar">
            <div role="tablist" aria-label="Workspace mode" className="ws-seg">
              <button
                role="tab"
                aria-selected={mode === "agent"}
                className={mode === "agent" ? "on" : ""}
                onClick={() => switchMode("agent")}
              >
                Ask the agent
              </button>
              <button
                role="tab"
                aria-selected={mode === "run"}
                className={mode === "run" ? "on" : ""}
                onClick={() => switchMode("run")}
              >
                Run my code
              </button>
            </div>
            <span className="ws-count">
              {mode === "agent"
                ? `${task.length} / 600`
                : `${fmtBytes(sourceBytes)} / 16 KB${tooBig ? " · too large" : ""}`}
            </span>
            <button
              className="ws-send"
              onClick={submit}
              disabled={!canSubmit}
              aria-label={mode === "agent" ? "Run agent" : "Run Python"}
              title={mode === "agent" ? "Run agent" : "Run Python"}
            >
              {busy === "agent" || busy === "python" ? <span className="ws-spin" /> : <Icon name="go" />}
            </button>
          </div>
        </div>

        {turnstileEnabled && (
          <div className="ws-verify">
            <Turnstile key={`ts-${mode}`} onToken={setToken} />
          </div>
        )}

        {busy === "agent" && (
          <p className="ws-note" role="status">
            The agent is working. It writes the code and its tests, runs them, reads the failures
            and fixes them. This can take a minute.
          </p>
        )}
        {mode === "run" && !turnstileEnabled && (
          <p className="ws-note">
            Code runs are switched off on this deployment until human verification is configured.
          </p>
        )}

        <ul className="ws-list" aria-label="Suggestions">
          {mode === "agent" &&
            AGENT_EXAMPLES.map((ex) => (
              <li key={ex.text}>
                <button type="button" onClick={() => setTask(ex.text)}>
                  <Icon name={ex.icon} />
                  <span>{ex.text}</span>
                </button>
              </li>
            ))}
          {mode === "run" && (
            <li>
              <button type="button" onClick={() => setSource(STARTER)}>
                <Icon name="file" />
                <span>Load the starter script</span>
              </button>
            </li>
          )}
          <li>
            <button type="button" onClick={() => exec("starter")} disabled={busy !== ""}>
              <Icon name="play" />
              <span>{busy === "starter" ? "Running…" : "Run web starter"}</span>
              <em>no verification needed</em>
            </button>
          </li>
        </ul>

        <div className="ws-facts" aria-label="Isolation">
          {FACTS.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
        <details className="ws-details">
          <summary>What a workspace can and cannot do</summary>
          <ul>
            {GUARANTEES.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          {mode === "agent" && (
            <p>
              The agent never gets a shell and cannot reach the network. It fixes its own code for up
              to 4 rounds. Limit: 5 tasks per day. Your code is saved nowhere; the audit log keeps
              only a hash.
            </p>
          )}
        </details>
      </section>

      <div className="ws-results">
      {error && (
        <section className="panel" role="alert">
          <p>{error}</p>
        </section>
      )}

      {agent && (
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

      {run && (
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
      </div>
    </>
  );
}
