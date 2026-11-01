"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatAgentId } from "@/lib/format";
import { HIDDEN_TASK_TEXT, isRedacted, useMyTasks } from "@/lib/mytasks";
import { usePoll } from "@/lib/usePoll";
import { DataGate, EmptyState, HashChip, Tile, When } from "@/lib/ui";
import { PageHeader } from "../components/PageHeader";

const PAGE = 15;

async function loadIntents() {
  return api.recentAudit(300, ["capability_check"]);
}

export default function TasksPage() {
  const { data, error, lastSyncMs, refresh } = usePoll(loadIntents, 4000);
  const myTasks = useMyTasks();
  const [shown, setShown] = useState(PAGE);
  const [onlyMine, setOnlyMine] = useState(false);
  const [q, setQ] = useState("");

  const tasks = useMemo(() => {
    const events = data?.events ?? [];
    return events
      .flatMap((e) => (e.kind.type === "intent_dispatched" ? [{ e, k: e.kind }] : []))
      .reverse();
  }, [data]);

  const rows = tasks
    .map(({ e, k }) => {
      const mine = myTasks[k.intent_id] ?? null;
      const text = mine ?? (isRedacted(k.intent_text) ? null : k.intent_text);
      return { e, k, mine: mine !== null, text };
    })
    .filter((r) => (onlyMine ? r.mine : true))
    .filter((r) => !q.trim() || (r.text ?? "").toLowerCase().includes(q.trim().toLowerCase()));

  const myCount = tasks.filter(({ k }) => myTasks[k.intent_id] !== undefined).length;
  const okCount = tasks.filter(({ k }) => k.status === "ok").length;

  return (
    <>
      <PageHeader
        eyebrow="What has been asked"
        title="Tasks"
        subhead="Every task sent to the sandbox, newest first. Open one to see its result and signed steps. Prompts from other visitors are hidden for privacy; yours are remembered in this browser only."
        syncMs={lastSyncMs}
        error={error}
        right={
          <Link href="/" className="btn primary">
            New task
          </Link>
        }
      />

      <DataGate loading={!data} error={error} onRetry={refresh} rows={5}>
        <section className="metric-row">
          <Tile label="Tasks in the log" value={tasks.length} caption="since the last sandbox reset" />
          <Tile label="Yours" value={myCount} caption="sent from this browser" />
          <Tile label="Finished OK" value={okCount} caption="completed without errors" />
          <Tile
            label="Latest"
            small
            value={tasks[0] ? <When ms={tasks[0].e.timestamp_ms} /> : "–"}
            caption="most recent task"
          />
        </section>

        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            body="Tasks you send from the Overview appear here with their result and signed steps."
            action={{ href: "/", label: "Send your first task" }}
          />
        ) : (
          <section className="panel flush">
            <div className="panel-head" style={{ padding: "20px 20px 0" }}>
              <h2>
                Recent tasks <span className="count">{rows.length}</span>
              </h2>
              <div className="actions-row">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search your tasks"
                  aria-label="Search your tasks"
                />
                <button
                  type="button"
                  className={onlyMine ? "btn small primary" : "btn small"}
                  aria-pressed={onlyMine}
                  onClick={() => setOnlyMine((v) => !v)}
                >
                  Only mine
                </button>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="empty" style={{ margin: 20 }}>
                No tasks match. {onlyMine && myCount === 0 ? "Tasks you send from this browser will show up here." : ""}
              </p>
            ) : (
              <div className="intent-list">
                {rows.slice(0, shown).map(({ e, k, mine, text }) => (
                  <Link
                    key={e.id}
                    href={`/intents/${k.intent_id}`}
                    className={`intent-row tone-${k.matched_agent ? "ok" : "warn"}`}
                  >
                    <div className="left">
                      <span className="text-muted ts">
                        <When ms={e.timestamp_ms} />
                        {mine && <span className="badge-you">You</span>}
                        {!mine && text?.toLowerCase().startsWith("sample:") && <span className="badge-sample">Example</span>}
                      </span>
                      <p className={text ? "text" : "text hidden-task"}>{text ?? HIDDEN_TASK_TEXT}</p>
                    </div>
                    <div className="right">
                      <span className="agent">
                        {k.matched_agent ? (
                          <>
                            Ran by <strong>{formatAgentId(k.matched_agent)}</strong>
                          </>
                        ) : (
                          <em>no agent matched</em>
                        )}
                      </span>
                      <span className="hash">{k.result_hash_hex.slice(0, 12)}…</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {rows.length > shown && (
              <div className="more-row" style={{ paddingBottom: 18 }}>
                <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({rows.length - shown} left)
                </button>
              </div>
            )}
          </section>
        )}
      </DataGate>

      <style jsx global>{`
        .hidden-task {
          color: var(--muted) !important;
          font-weight: 500 !important;
          font-style: italic;
        }
        .intent-row .ts {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
    </>
  );
}
