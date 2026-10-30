"use client";

import Link from "next/link";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { saveReply } from "@/lib/intentReplies";
import { SAMPLE_PROMPTS, saveMyTask, takePrefill } from "@/lib/mytasks";
import { eventLabel, memoryTierLabel } from "@/lib/labels";
import { useRightRail } from "@/lib/rightRail";
import { usePoll } from "@/lib/usePoll";
import { EmptyState, ErrorState, Tile, When, friendlyError } from "@/lib/ui";
import { PageHeader } from "./components/PageHeader";
import { Turnstile, turnstileEnabled } from "./components/Turnstile";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

async function loadOverview() {
  const [audit, peers, caps, memory] = await Promise.all([
    api.recentAudit(60),
    api.listPeers(50),
    api.recentCapabilities(50),
    api.recentMemory(50),
  ]);
  return { audit, peers, caps, memory };
}

export default function OverviewPage() {

  const { data, error, lastSyncMs, refresh } = usePoll(loadOverview, 4000);
  const [intent, setIntent] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyOk, setVerifyOk] = useState(true);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  // "Try it" buttons on other pages park a prompt in sessionStorage.
  useEffect(() => {
    const p = takePrefill();
    if (!p) return;
    const frame = window.requestAnimationFrame(() => {
      setIntent(p);
      areaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const sendIntent = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setDispatching(true);
      setLastError(null);
      try {
        const r = await api.submitIntent(trimmed, turnstileToken ?? undefined);
        if (r.kind === "intent_result") {
          // Remember the prompt (this browser only) so the redacted public
          // log still reads sensibly to the person who sent it.
          saveMyTask(r.intent_id, trimmed);
          if (r.text) saveReply(r.intent_id, r.text);
          // Hard navigation: client-side router.push is swallowed by the
          // right-rail re-render loop on this page (same reason the old
          // composer used location.assign).
          window.location.assign(`/intents/${r.intent_id}`);
          return;
        }
        setLastError(r.message);
      } catch (e) {
        setLastError(friendlyError(e instanceof Error ? e.message : String(e)));
      } finally {
        setDispatching(false);
        if (turnstileEnabled) window.__covTurnstileReset?.();
      }
    },
    [turnstileToken],
  );

  const onDispatch = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      return sendIntent(intent);
    },
    [intent, sendIntent],
  );

  const onVerify = useCallback(async () => {
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const r = await api.verifyAudit();
      setVerifyOk(r.report.valid);
      setVerifyMsg(
        r.report.valid
          ? `Activity log verified: ${r.report.events} signed steps, all intact.`
          : `Activity log tampered: ${r.report.failures.length} ${
              r.report.failures.length === 1 ? "failure" : "failures"
            } detected.`,
      );
    } catch (e) {
      setVerifyOk(false);
      setVerifyMsg(`Couldn't verify: ${friendlyError(e instanceof Error ? e.message : String(e))}`);
    } finally {
      setVerifying(false);
    }
  }, []);

  const events = data?.audit.events ?? [];
  const recent = events.slice().reverse();
  // Collapse runs of identical activity (the console's own permission
  // checks) into one row with a count.
  const dedupedRecent = (() => {
    const out: { event: (typeof recent)[number]; count: number }[] = [];
    const idx = new Map<string, number>();
    for (const event of recent) {
      const label = eventLabel(event);
      const key = `${label.headline}|${label.body}|${event.issuer.pubkey}`;
      const at = idx.get(key);
      if (at !== undefined) {
        out[at].count++;
        continue;
      }
      idx.set(key, out.length);
      out.push({ event, count: 1 });
    }
    return out.slice(0, 6);
  })();
  const peers = data?.peers.peers ?? [];
  const livePeers = peers.filter((p) => p.revoked_at === null);
  const caps = data?.caps.capabilities ?? [];
  const memory = data?.memory.records ?? [];
  const taskCount = events.filter((e) => e.kind.type === "intent_dispatched").length;

  const rail = (
    <div className="rail-section">
      <div className="rail-head">
        <p className="eyebrow">Recent activity</p>
        <Link className="rail-link" href="/audit">
          See all
        </Link>
      </div>
      {!data ? (
        <p className="empty">Loading…</p>
      ) : recent.length === 0 ? (
        <p className="empty">Nothing yet. Send a task and its steps will show up here.</p>
      ) : (
        <div className="records">
          {dedupedRecent.map(({ event, count }) => {
            const label = eventLabel(event);
            const inner = (
              <>
                <div className="ts">
                  <When ms={event.timestamp_ms} />
                  <em>{label.headline}</em>
                  {count > 1 && <span className="dupe">×{count}</span>}
                </div>
                <div className="body">
                  <p>{label.body}</p>
                </div>
              </>
            );
            if (label.intentId) {
              return (
                <Link
                  key={event.id}
                  href={`/intents/${label.intentId}`}
                  className={`record clickable tone-${label.tone}`}
                >
                  {inner}
                </Link>
              );
            }
            return (
              <article key={event.id} className={`record tone-${label.tone}`}>
                {inner}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
  const railPortal = useRightRail(rail);

  return (
    <>
      {railPortal}
      <PageHeader
        eyebrow={DEMO_MODE ? "Public sandbox" : "Local control plane"}
        title={DEMO_MODE ? "Try the Sandbox Assistant" : "Send tasks to your agents"}
        subhead={
          DEMO_MODE
            ? "Type a short request. The assistant answers, and every step it takes is signed and written to a log anyone can verify."
            : "Send tasks to your agents, manage their permissions, and check that the activity log is intact."
        }
        syncMs={lastSyncMs}
        error={error}
        right={
          <button type="button" className="btn" onClick={onVerify} disabled={verifying}>
            {verifying ? "Verifying…" : "Verify activity log"}
          </button>
        }
      />

      {error && !data && <ErrorState message={error} onRetry={refresh} />}

      {verifyMsg && (
        <p className={`verify-line ${verifyOk ? "ok" : "bad"}`} role="status">
          {verifyMsg}
        </p>
      )}

      <section className="dispatch-card" aria-label="Send a task">
        <form onSubmit={onDispatch}>
          <label htmlFor="composer" className="composer-label">
            Your task
          </label>
          <textarea
            id="composer"
            ref={areaRef}
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onDispatch(e);
            }}
            placeholder="For example: hash hello world"
            rows={3}
            maxLength={2000}
          />
          {turnstileEnabled && <Turnstile onToken={setTurnstileToken} />}
          <div className="actions">
            <button
              type="submit"
              className="btn primary"
              disabled={dispatching || !intent.trim() || (turnstileEnabled && !turnstileToken)}
            >
              {dispatching ? "Sending…" : "Send task"}
            </button>
            <span className="text-muted hint">Ctrl/⌘ + Enter to send</span>
          </div>
          {lastError && (
            <p className="form-error" role="alert">
              {lastError}
            </p>
          )}
          <div className="sample-chips">
            <span className="text-muted">Try:</span>
            {SAMPLE_PROMPTS.map((s) => (
              <button
                key={s.skill}
                type="button"
                className="btn chip"
                onClick={() => {
                  setIntent(s.prompt);
                  areaRef.current?.focus();
                }}
                disabled={dispatching}
                title={s.what}
              >
                {s.prompt.length > 28 ? s.skill : s.prompt}
              </button>
            ))}
          </div>
          <p className="honest-note">
            The Sandbox Assistant is a small rule-based program that runs locally, not an AI language
            model. It handles the examples above: hashing, counting, planning, calculating, unit
            conversion and notes. Anything else gets a short help message.
          </p>
          {turnstileEnabled && (
            <p className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>
              Protected by Cloudflare Turnstile.{" "}
              <a href="https://usenoren.xyz/privacy" target="_blank" rel="noopener noreferrer">
                Privacy policy
              </a>
              .
            </p>
          )}
        </form>
      </section>

      <h2 className="section-title">Where things are</h2>
      <section className="state-tiles">
        <Link href="/intents" className="state-tile">
          <span className="eyebrow">Tasks</span>
          <span className="value">{data ? taskCount : "–"}</span>
          <span className="caption">sent to the assistant. Open one to see its steps.</span>
        </Link>
        <Link href="/audit" className="state-tile">
          <span className="eyebrow">Activity</span>
          <span className="value">{data ? events.length : "–"}</span>
          <span className="caption">recent signed log entries</span>
        </Link>
        <Link href="/capabilities" className="state-tile">
          <span className="eyebrow">Permissions</span>
          <span className="value">{data ? caps.length : "–"}</span>
          <span className="caption">what agents are allowed to do</span>
        </Link>
        <Link href="/memory" className="state-tile">
          <span className="eyebrow">Memory</span>
          <span className="value">{data ? memory.length : "–"}</span>
          <span className="caption">
            {data
              ? `${memory.filter((m) => m.tier === "working").length} ${memoryTierLabel("working").toLowerCase()} · ${memory.filter((m) => m.tier === "episodic").length} ${memoryTierLabel("episodic").toLowerCase()} · ${memory.filter((m) => m.tier === "longterm").length} ${memoryTierLabel("longterm").toLowerCase()}`
              : "notes agents have saved"}
          </span>
        </Link>
        <Link href="/peers" className="state-tile">
          <span className="eyebrow">Agents</span>
          <span className="value">{data ? livePeers.length : "–"}</span>
          <span className="caption">
            {peers.length - livePeers.length === 0 ? "connected" : `${peers.length - livePeers.length} revoked`}
          </span>
        </Link>
        <Link href="/sap" className="state-tile">
          <span className="eyebrow">Settlement</span>
          <span className="value small">Coming soon</span>
          <span className="caption">Robinhood Chain (4663), USDG</span>
        </Link>
      </section>

      {data && taskCount === 0 && (
        <EmptyState
          title="No tasks yet"
          body="Pick an example above or type your own. The result appears on the task page together with its signed steps."
        />
      )}

      <h2 className="section-title">How it works</h2>
      <section className="steps">
        <article className="step">
          <span className="n">1. Ask</span>
          <h3>Send a short request</h3>
          <p>Use one of the examples or type your own, such as “calc 12*(3+4)”.</p>
        </article>
        <article className="step">
          <span className="n">2. Watch</span>
          <h3>See the result and steps</h3>
          <p>The task page shows the answer and each step the assistant took.</p>
        </article>
        <article className="step">
          <span className="n">3. Verify</span>
          <h3>Check the log is intact</h3>
          <p>Every step is signed and chained. One click on Activity verifies it.</p>
        </article>
      </section>

      <style jsx global>{`
        .dispatch-card {
          margin: 4px 0 8px;
          padding: 22px;
          border: 1px solid var(--border-soft);
          border-radius: var(--radius);
          background: #ffffff;
          box-shadow: var(--shadow);
        }

        .dispatch-card form {
          display: grid;
          gap: 12px;
        }

        .composer-label {
          color: var(--forest);
          font-size: 16px;
          font-weight: 700;
        }

        .dispatch-card textarea {
          min-height: 92px;
          border-radius: 14px;
          background: var(--bg);
          border-color: transparent;
          font-size: 16px;
          padding: 14px 16px;
        }

        .dispatch-card textarea:focus {
          background: #ffffff;
        }

        .dispatch-card .actions {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .hint {
          font-size: 13px;
        }

        .sample-chips {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }

        .honest-note {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }

        .form-error {
          margin: 0;
          padding: 10px 14px;
          border-radius: 12px;
          background: #fff1f0;
          color: var(--tone-danger);
          font-size: 14px;
        }

        .verify-line {
          margin: 0 0 12px;
          padding: 10px 14px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid var(--border-soft);
          font-size: 14px;
        }

        .verify-line.ok {
          color: var(--tone-ok);
        }

        .verify-line.bad {
          color: var(--tone-danger);
        }

        .state-tiles {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin: 8px 0 20px;
        }

        .state-tile {
          display: grid;
          align-content: start;
          gap: 4px;
          min-height: 40px;
          padding: 16px 18px;
          border: 1px solid var(--border-soft);
          border-radius: var(--radius);
          background: #ffffff;
          color: inherit;
          transition: border-color 120ms ease;
        }

        .state-tile:hover {
          border-color: var(--border-strong);
        }

        .state-tile .eyebrow {
          margin: 0;
          font-weight: 600;
        }

        .state-tile .value {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.1;
          color: var(--forest);
        }

        .state-tile .value.small {
          font-size: 18px;
          padding: 4px 0;
        }

        .state-tile .caption {
          color: var(--fg-soft);
          font-size: 13.5px;
        }

        @media (max-width: 1100px) {
          .state-tiles {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .state-tiles {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        .rail-section {
          display: grid;
          gap: 10px;
          min-width: 0;
        }

        .rail-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .rail-head .eyebrow {
          margin: 0;
          color: var(--forest);
          font-size: 15px;
        }

        .rail-link {
          color: var(--forest);
          font-size: 13px;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .records .dupe {
          margin-left: 8px;
          padding: 0 8px;
          border-radius: 999px;
          background: var(--sunken);
          color: var(--forest);
          font-size: 11px;
          font-weight: 600;
        }
      `}</style>
    </>
  );
}
