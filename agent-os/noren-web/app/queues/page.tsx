"use client";

import { api, type ContentBlock } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { DataGate, EmptyState, HashChip, Tile } from "@/lib/ui";
import { truncate } from "@/lib/format";
import { PageHeader } from "../components/PageHeader";

async function loadQueues() {
  const [tasks, results] = await Promise.all([api.recentA2ATasks(40), api.recentA2AResults(40)]);
  return { tasks: tasks.tasks ?? [], results: results.results ?? [] };
}

function summary(content: ContentBlock[]): string {
  const text = content
    .map((b) => (b.type === "text" ? b.text : "(data)"))
    .join(" ")
    .trim();
  return truncate(text || "(no reply text)", 220);
}

function statusWord(status: string): string {
  switch (status) {
    case "ok":
      return "Done";
    case "error":
      return "Failed";
    case "partial":
      return "Partial";
    default:
      return status ? status[0].toUpperCase() + status.slice(1) : "–";
  }
}

export default function MessagesPage() {
  const { data, error, lastSyncMs, refresh } = usePoll(loadQueues, 5000);
  const tasks = data?.tasks ?? [];
  const results = data?.results ?? [];
  const failed = results.filter((r) => r.status === "error").length;

  return (
    <>
      <PageHeader
        eyebrow="Advanced · agents talking to each other"
        title="Messages"
        subhead="When one agent hands work to another, the request and the reply show up here. The Sandbox Assistant works alone, so this stays empty until several agents are connected."
        syncMs={lastSyncMs}
        error={error}
      />

      <DataGate loading={!data} error={error} onRetry={refresh} rows={3}>
        <section className="metric-row">
          <Tile label="Requests sent" value={tasks.length} caption="agent to agent" />
          <Tile label="Replies" value={results.length} caption="received back" />
          <Tile label="Failed" value={failed} caption="replies with an error" />
          <Tile label="Needs" small value="Signed permission" caption="every message is permission-checked" />
        </section>

        <section className="split-2">
          <div className="panel">
            <div className="panel-head">
              <h2>
                Requests <span className="count">{tasks.length}</span>
              </h2>
            </div>
            {tasks.length === 0 ? (
              <EmptyState
                title="No messages yet"
                body="Messages appear when agents talk to each other. Nothing has been handed off in this sandbox."
                action={{ href: "/peers", label: "See connected agents" }}
              />
            ) : (
              <div className="records">
                {tasks.map((t) => (
                  <article key={t.id} className="record">
                    <div className="ts">
                      <HashChip value={t.id} length={8} />
                    </div>
                    <div className="body">
                      <strong>
                        {t.sender.display} → {t.recipient.display}
                      </strong>
                      <p>{truncate(t.intent_text, 200)}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>
                Replies <span className="count">{results.length}</span>
              </h2>
            </div>
            {results.length === 0 ? (
              <EmptyState
                title="No replies yet"
                body="Replies show up here after another agent answers a request."
              />
            ) : (
              <div className="records">
                {results.map((r) => (
                  <article key={r.task_id} className={`record ${r.status !== "ok" ? "tone-warn" : ""}`}>
                    <div className="ts">{statusWord(r.status)}</div>
                    <div className="body">
                      <strong>Reply to {r.task_id.slice(0, 8)}…</strong>
                      <p>
                        {summary(r.content)}
                        {r.error_message && ` · error: ${r.error_message}`}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </DataGate>
    </>
  );
}
