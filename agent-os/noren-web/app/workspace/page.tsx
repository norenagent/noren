"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, type AgentCodeResult, type WorkspaceRun } from "@/lib/api";
import { friendlyError } from "@/lib/ui";
import { buildPreviewDocument } from "@/lib/preview";
import { useWallet } from "@/lib/wallet";
import { Turnstile, turnstileEnabled } from "../components/Turnstile";

type Mode = "agent" | "run";

type Turn = {
  id: number;
  mode: Mode | "starter";
  prompt: string;
  state: "working" | "done" | "error";
  agent?: AgentCodeResult;
  run?: WorkspaceRun;
  error?: string;
  at: number;
};

const FACTS = ["gVisor kernel", "No network", "1 CPU · 128 MB · 10 s", "Deleted afterwards"];

const STARTER = `# Python 3.12 · standard library only · no network
import json, hashlib

data = {"hello": "noren", "sum": sum(range(10))}
print(json.dumps(data))
print(hashlib.sha256(json.dumps(data).encode()).hexdigest())

with open("/workspace/result.json", "w") as f:
    json.dump(data, f)
`;

const IDEAS: { icon: string; title: string; text: string }[] = [
  { icon: "web", title: "Landing page", text: "Build a one-page landing site for a coffee shop called Ember with a hero, a menu and a footer" },
  { icon: "fn", title: "Function with tests", text: "Write a function that reverses the words in a sentence, with tests" },
  { icon: "cache", title: "LRU cache", text: "Implement a small LRU cache class with tests" },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "web") return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18" /><path d="M7 6.5h.01M10 6.5h.01" /></svg>;
  if (name === "fn") return <svg {...p}><path d="m8 7-5 5 5 5" /><path d="m16 7 5 5-5 5" /><path d="m13.5 5-3 14" /></svg>;
  if (name === "cache") return <svg {...p}><rect x="4" y="4" width="16" height="6" rx="2" /><rect x="4" y="14" width="16" height="6" rx="2" /><path d="M8 7h.01M8 17h.01" /></svg>;
  if (name === "play") return <svg {...p}><path d="M7 5v14l11-7z" /></svg>;
  if (name === "up") return <svg {...p}><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>;
  if (name === "check") return <svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
  if (name === "x") return <svg {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
  if (name === "download") return <svg {...p}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>;
  if (name === "wallet") return <svg {...p}><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h12a2 2 0 0 1 2 2v2.5M3.5 7.5V17a2 2 0 0 0 2 2H19a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 19 8H6a2.5 2.5 0 0 1-2.5-.5zM16 13.5h.01" /></svg>;
  return <svg {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
}

function downloadText(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function ResultView({ turn }: { turn: Turn }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [fileIx, setFileIx] = useState(0);
  const a = turn.agent;
  const preview = useMemo(() => (a ? buildPreviewDocument(a.files) : null), [a]);

  if (turn.state === "error") {
    return (
      <div className="wk-card wk-err" role="alert">
        <Icon name="x" /> <span>{turn.error}</span>
      </div>
    );
  }

  if (a) {
    const passed = a.status === "passed";
    const file = a.files[Math.min(fileIx, a.files.length - 1)];
    const hasPreview = !!preview;
    const view = hasPreview ? tab : "code";
    return (
      <div className="wk-stack">
        <div className="wk-card">
          <div className="wk-steps">
            {a.rounds.map((r) => (
              <details key={r.round} className="wk-step" open={a.rounds.length === 1 || r.round === a.rounds.length}>
                <summary>
                  <span className={r.passed ? "wk-ic ok" : "wk-ic bad"}><Icon name={r.passed ? "check" : "x"} size={14} /></span>
                  <strong>Round {r.round}</strong>
                  <span className="wk-mute">{r.passed ? "tests passed" : "tests failed, the agent fixes them"}</span>
                </summary>
                {r.stdout && <pre>{r.stdout}</pre>}
                <pre>{r.stderr || "(the tests printed nothing)"}</pre>
              </details>
            ))}
          </div>
          <p className={passed ? "wk-verdict ok" : "wk-verdict bad"}>
            {a.message || (passed ? `Done in ${a.rounds.length} ${a.rounds.length === 1 ? "round" : "rounds"}, all tests pass.` : `Finished as ${a.status.replace("_", " ")}.`)}
          </p>
        </div>

        {a.files.length > 0 && (
          <div className="wk-card wk-out">
            <div className="wk-outbar">
              <div className="wk-tabs" role="tablist">
                {hasPreview && (
                  <button role="tab" aria-selected={view === "preview"} className={view === "preview" ? "on" : ""} onClick={() => setTab("preview")}>Preview</button>
                )}
                <button role="tab" aria-selected={view === "code"} className={view === "code" ? "on" : ""} onClick={() => setTab("code")}>Code</button>
              </div>
              {view === "code" && a.files.length > 1 && (
                <div className="wk-files">
                  {a.files.map((f, i) => (
                    <button key={f.name} className={i === fileIx ? "on" : ""} onClick={() => setFileIx(i)}>{f.name}</button>
                  ))}
                </div>
              )}
              {view === "code" && file && (
                <button className="wk-ghost" onClick={() => downloadText(file.name, file.content)}>
                  <Icon name="download" size={15} /> {file.name}
                </button>
              )}
            </div>
            {view === "preview" && preview ? (
              <iframe
                title="Site preview"
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                srcDoc={preview}
                className="wk-frame"
              />
            ) : (
              file && <pre className="wk-code">{file.content}</pre>
            )}
            {view === "preview" && <p className="wk-mute wk-small">Shown in a locked-down frame: no network, no cookies, no access to this page.</p>}
          </div>
        )}
      </div>
    );
  }

  const r = turn.run;
  if (r) {
    const total = r.artifacts.reduce((n, x) => n + x.bytes, 0);
    return (
      <div className="wk-card">
        <p className="wk-label">Output</p>
        <pre>
          {r.stdout || "(no output)"}
          {r.stdout_truncated ? "\n[stdout truncated]" : ""}
          {r.stderr ? `\n${r.stderr}` : ""}
          {r.stderr_truncated ? "\n[stderr truncated]" : ""}
        </pre>
        <p className="wk-label">Files <span className="wk-mute">{r.artifacts.length} · {fmtBytes(total)}</span></p>
        <ul className="wk-artifacts">
          {r.artifacts.map((x) => (
            <li key={x.path}><code>{x.path}</code><span className="wk-mute">{fmtBytes(x.bytes)}</span></li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
}

export default function WorkspacePage() {
  const wallet = useWallet();
  const [mode, setMode] = useState<Mode>("agent");
  const [task, setTask] = useState("");
  const [source, setSource] = useState(STARTER);
  const [token, setToken] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const seq = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.state === "working");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const sourceBytes = new TextEncoder().encode(source).length;
  const tooBig = sourceBytes > 16 * 1024;
  const needsVerify = turnstileEnabled && !token;
  const needsWallet = wallet.enabled && !wallet.ready;
  const hasInput = mode === "agent" ? task.trim().length > 0 : sourceBytes > 0 && !tooBig;
  const canSend = !busy && hasInput && !needsVerify && !needsWallet;

  function patch(id: number, p: Partial<Turn>) {
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }

  async function send(kind: "agent" | "python" | "starter", promptText?: string) {
    const id = (seq.current += 1);
    const label = kind === "starter" ? "Run the web starter" : kind === "agent" ? (promptText ?? task).trim() : "Run my Python";
    setTurns((all) => [...all, { id, mode: kind === "python" ? "run" : kind, prompt: label, state: "working", at: Date.now() }]);
    const tok = token ?? undefined;
    if (kind === "agent") setTask("");
    try {
      if (kind === "agent") patch(id, { state: "done", agent: await api.runAgentCode(label, tok) });
      else if (kind === "python") patch(id, { state: "done", run: await api.runPython(source, tok) });
      else patch(id, { state: "done", run: await api.runWebStarter() });
    } catch (e) {
      patch(id, { state: "error", error: friendlyError(e instanceof Error ? e.message : "Workspace run failed") });
    } finally {
      if (kind !== "starter") window.__covTurnstileReset?.();
    }
  }

  const submit = () => {
    if (needsWallet) return wallet.start();
    if (canSend) void send(mode === "agent" ? "agent" : "python");
  };

  const empty = turns.length === 0;

  const composer = (
    <div className={empty ? "wk-composer" : "wk-composer dock"}>
      {mode === "agent" ? (
        <textarea
          aria-label="Task for the code agent"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={600}
          rows={empty ? 3 : 2}
          placeholder="Describe a small program. The agent writes it, tests it and fixes it."
        />
      ) : (
        <textarea
          aria-label="Python source"
          className="code"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          rows={empty ? 9 : 6}
        />
      )}
      <div className="wk-bar">
        <div role="tablist" aria-label="Workspace mode" className="wk-tabs">
          <button role="tab" aria-selected={mode === "agent"} className={mode === "agent" ? "on" : ""} onClick={() => setMode("agent")}>Ask the agent</button>
          <button role="tab" aria-selected={mode === "run"} className={mode === "run" ? "on" : ""} onClick={() => setMode("run")}>Run my code</button>
        </div>
        <span className="wk-mute wk-count">
          {mode === "agent" ? `${task.length} / 600` : `${fmtBytes(sourceBytes)} / 16 KB${tooBig ? " · too large" : ""}`}
        </span>
        <button
          className={needsWallet ? "wk-send wallet" : "wk-send"}
          onClick={submit}
          disabled={needsWallet ? wallet.signing : !canSend}
          aria-label={needsWallet ? "Connect wallet" : "Send"}
        >
          {busy ? <span className="wk-spin" /> : needsWallet ? <><Icon name="wallet" size={16} /><span>{wallet.signing ? "Check wallet…" : wallet.connected ? "Sign in" : "Connect wallet"}</span></> : <Icon name="up" />}
        </button>
      </div>
      {turnstileEnabled && (
        <div className="wk-verify">
          <Turnstile key={`ts-${mode}`} onToken={setToken} />
        </div>
      )}
      {wallet.error && <p className="wk-warn">{wallet.error}</p>}
    </div>
  );

  return (
    <div className={empty ? "wk wk-empty" : "wk"}>
      {empty ? (
        <div className="wk-hero">
          <p className="wk-hi">{greeting()}.</p>
          <h1>What should run in the sandbox?</h1>
          {composer}
          <div className="wk-ideas">
            {IDEAS.map((i) => (
              <button
                key={i.title}
                type="button"
                onClick={() => {
                  setMode("agent");
                  setTask(i.text);
                }}
              >
                <span className="wk-ideaic"><Icon name={i.icon} /></span>
                <strong>{i.title}</strong>
                <span>{i.text}</span>
              </button>
            ))}
          </div>
          <button type="button" className="wk-starter" onClick={() => void send("starter")} disabled={busy}>
            <Icon name="play" size={15} /> Run the web starter <em>no verification needed</em>
          </button>
          <div className="wk-facts" aria-label="Isolation">
            {FACTS.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="wk-thread">
            {turns.map((t) => (
              <div key={t.id} className="wk-turn">
                <div className="wk-me"><span>{t.prompt}</span></div>
                {t.state === "working" ? (
                  <div className="wk-card wk-working" role="status">
                    <span className="wk-spin" />
                    <span>
                      {t.mode === "agent"
                        ? "The agent is writing the code and its tests, running them and fixing failures. This can take a minute."
                        : "Running in a throwaway workspace…"}
                    </span>
                  </div>
                ) : (
                  <ResultView turn={t} />
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {composer}
        </>
      )}
    </div>
  );
}
