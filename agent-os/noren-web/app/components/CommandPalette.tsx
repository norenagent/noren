"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { saveMyTask, setPrefill } from "@/lib/mytasks";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
const DEMO_INTENTS = ["hash hello world", "calc 12*(3+4)", "plan launch a newsletter"];

type Action = {
  id: string;
  label: string;
  hint: string;
  run: () => Promise<void> | void;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const focusOnMount = useCallback((node: HTMLInputElement | null) => {
    if (node) node.focus();
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
    setFeedback(null);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close],
  );

  const verifyChain = useCallback(async () => {
    setBusy("verify");
    try {
      const r = await api.verifyAudit();
      setFeedback(
        r.report.valid
          ? `Activity log verified · ${r.report.events} signed steps`
          : `Activity log tampered · ${r.report.failures.length} ${
              r.report.failures.length === 1 ? "failure" : "failures"
            }`,
      );
    } catch (e) {
      setFeedback(`Couldn't verify: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }, []);

  const dispatchIntent = useCallback(
    async (text: string) => {
      const intent = text.trim();
      if (!intent) return;
      setBusy("dispatch");
      try {
        const r = await api.submitIntent(intent);
        if (r.kind === "intent_result") {
          saveMyTask(r.intent_id, intent);
          window.location.assign(`/intents/${r.intent_id}`);
          close();
        } else {
          setFeedback(`Error · ${r.message}`);
        }
      } catch (e) {
        setFeedback(`Error · ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(null);
      }
    },
    [close],
  );

  const grantCapability = useCallback(async (action: string) => {
    const cap = action.trim();
    if (!cap) return;
    setBusy("grant");
    try {
      await api.grantCapability(cap);
      setFeedback(`Granted · ${cap}`);
    } catch (e) {
      setFeedback(`Error · ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }, []);

  const baseActions = useMemo<Action[]>(() => {
    const sampleIntents: Action[] = DEMO_MODE
      ? DEMO_INTENTS.map((text, i) => ({
          id: `demo-intent-${i}`,
          label: `Try: ${text}`,
          hint: "example task",
          run: () => {
            setPrefill(text);
            navigate("/");
          },
        }))
      : [];
    const coreNav: Action[] = [
      { id: "nav-overview", label: "Go to Overview", hint: "g o", run: () => navigate("/") },
      { id: "nav-intents", label: "Go to Tasks", hint: "g t", run: () => navigate("/intents") },
      { id: "nav-audit", label: "Go to Activity", hint: "g a", run: () => navigate("/audit") },
      { id: "nav-capabilities", label: "Go to Permissions", hint: "g p", run: () => navigate("/capabilities") },
      { id: "nav-memory", label: "Go to Memory", hint: "g m", run: () => navigate("/memory") },
      { id: "nav-peers", label: "Go to Agents", hint: "g r", run: () => navigate("/peers") },
    ];
    const opsNav: Action[] = [
      { id: "nav-queues", label: "Go to Messages", hint: "advanced", run: () => navigate("/queues") },
      { id: "nav-settlement", label: "Go to Spending", hint: "advanced", run: () => navigate("/settlement") },
      { id: "nav-generations", label: "Go to Generations", hint: "advanced", run: () => navigate("/generations") },
      { id: "nav-sap", label: "Go to Settlement", hint: "advanced", run: () => navigate("/sap") },
    ];
    return [
      ...sampleIntents,
      ...coreNav,
      ...opsNav,
      { id: "verify", label: "Verify activity log", hint: "check nothing was altered", run: verifyChain },
    ];
  }, [navigate, verifyChain]);

  const dynamicActions = useMemo<Action[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("> ")) {
      const text = trimmed.slice(2);
      return [
        {
          id: "intent-dispatch",
          label: `Send task · "${text.slice(0, 60)}"`,
          hint: "press enter",
          run: () => dispatchIntent(text),
        },
      ];
    }
    if (trimmed.startsWith("grant ")) {
      const action = trimmed.slice("grant ".length);
      return [
        {
          id: "cap-grant",
          label: `Grant permission · ${action}`,
          hint: "press enter",
          run: () => grantCapability(action),
        },
      ];
    }
    return [];
  }, [query, dispatchIntent, grantCapability]);

  const actions = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filteredBase = !q
      ? baseActions
      : baseActions.filter(
          (action) => action.label.toLowerCase().includes(q) || action.hint.toLowerCase().includes(q),
        );
    return [...dynamicActions, ...filteredBase];
  }, [baseActions, dynamicActions, query]);

  // The footer's quick-actions button opens the palette through this event.
  useEffect(() => {
    const openFromButton = () => setOpen(true);
    window.addEventListener("noren:open-palette", openFromButton);
    return () => window.removeEventListener("noren:open-palette", openFromButton);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (open && event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setSelected(0);
  }, [open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(0);
  }, [query]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((s) => Math.min(s + 1, actions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const action = actions[selected];
      if (action) action.run();
    }
  }

  if (!open) return null;

  return (
    <div className="palette-root" role="dialog" aria-modal="true">
      <button type="button" className="palette-scrim" aria-label="close" onClick={close} />
      <div className="palette">
        <div className="palette-input">
          <span aria-hidden>⌘K</span>
          <input
            ref={focusOnMount}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type to search, or > to send a task"
            aria-label="Quick actions"
            spellCheck={false}
          />
        </div>
        {feedback && <p className="palette-feedback">{feedback}</p>}
        <ul className="palette-list">
          {actions.length === 0 && <li className="palette-empty">no matches</li>}
          {actions.map((action, idx) => (
            <li
              key={action.id}
              className={idx === selected ? "palette-item active" : "palette-item"}
              onMouseEnter={() => setSelected(idx)}
            >
              <button type="button" onClick={action.run} disabled={busy !== null}>
                <span>{action.label}</span>
                <em>{action.hint}</em>
              </button>
            </li>
          ))}
        </ul>
        <div className="palette-foot">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>esc dismiss</span>
        </div>
      </div>

      <style jsx>{`
        .palette-root {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: grid;
          place-items: start center;
          padding: 12vh 20px 20px;
        }

        .palette-scrim {
          position: absolute;
          inset: 0;
          background: rgba(16, 36, 26, 0.45);
          backdrop-filter: blur(6px);
          border: 0;
          padding: 0;
          cursor: default;
        }

        .palette {
          position: relative;
          width: min(620px, 100%);
          border: 0;
          border-radius: 24px;
          background: var(--panel);
          box-shadow: 0 24px 60px -20px rgba(16, 36, 26, 0.5);
          overflow: hidden;
        }

        .palette-input {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border);
        }

        .palette-input span {
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0;
        }

        .palette-input input {
          flex: 1;
          background: transparent;
          border: 0;
          color: var(--fg);
          font-family: var(--font-body);
          font-size: 15px;
          padding: 4px 0;
          outline: none;
        }

        .palette-feedback {
          margin: 0;
          padding: 10px 18px;
          border-bottom: 1px solid var(--border);
          background: var(--sunken);
          color: var(--dim);
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .palette-list {
          max-height: 50vh;
          overflow: auto;
          margin: 0;
          padding: 6px 0;
          list-style: none;
        }

        .palette-empty {
          padding: 18px;
          text-align: center;
          color: var(--muted);
          font-size: 13px;
        }

        .palette-item button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 10px 18px;
          background: transparent;
          border: 0;
          color: var(--fg);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
        }

        .palette-item button em {
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 11px;
          font-style: normal;
          letter-spacing: 0;
        }

        .palette-item.active button,
        .palette-item button:hover {
          background: var(--lime);
        }

        .palette-foot {
          display: flex;
          gap: 18px;
          padding: 10px 18px;
          border-top: 1px solid var(--border);
          background: var(--sunken);
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0;
        }
      `}</style>
    </div>
  );
}
