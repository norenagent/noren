"use client";

import { useState } from "react";
import { api, type AuditEvent } from "@/lib/api";
import { formatDateTime, formatTimestamp, shortHash, shortPubkey } from "@/lib/format";
import { usePoll } from "@/lib/usePoll";
import { PageHeader } from "../components/PageHeader";
import { DataGate, EmptyState, Tile } from "@/lib/ui";

// The daemon emits this audit kind for every AceData generation. It is
// not (yet) part of the shared AuditKind union — this page narrows the
// audit feed to it directly, so it stays self-contained and the main
// Activity log renders it through its generic fallback.
type AceDataGenerationKind = {
  type: "ace_data_generation";
  agent_id: string;
  tool: string;
  model: string;
  prompt_sha256: string;
  output_sha256: string;
  assets: string[];
  task_id: string | null;
};

type Generation = {
  id: string;
  timestamp_ms: number;
  issuer: { display: string; pubkey: string };
  kind: AceDataGenerationKind;
};

// Generation's kind sits outside the AuditKind union, so it cannot be a type
// predicate over AuditEvent; the filter below narrows through unknown instead.
function isGeneration(event: AuditEvent): boolean {
  return (event.kind as { type: string }).type === "ace_data_generation";
}

const TOOL_LABELS: Record<string, string> = {
  "acedata.image.generate": "Image",
  "acedata.music.generate": "Music",
  "acedata.search": "Search",
};

function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

async function loadGenerations() {
  return api.recentAudit(200);
}

export default function GenerationsPage() {
  const { data, error, lastSyncMs, refresh } = usePoll(loadGenerations, 5000);
  const [selected, setSelected] = useState<string | null>(null);

  const events = data?.events ?? [];
  const generations = (events.filter(isGeneration) as unknown as Generation[]).reverse();
  const selectedGen = selected
    ? generations.find((g) => g.id === selected) ?? null
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Advanced · verifiable generation"
        title="Generations"
        subhead="Images, songs and searches that agents produced through an external generation provider, with proof of which model made them and hashes of the prompt and output. The Sandbox Assistant does not generate media, so this is empty here."
        syncMs={lastSyncMs}
        error={error}
      />

      <DataGate loading={!data} error={error} onRetry={refresh} rows={3}>
      <section className="metric-row">
        <Tile label="Generations" value={generations.length} caption="recorded in the log" />
        <Tile label="Provider" small value="Not connected" caption="no media provider in this sandbox" />
      </section>
      <section className="explorer">
        <div className="list">
          {generations.length === 0 ? (
            <EmptyState
              title="No generations yet"
              body="Generations appear here when an agent with a media provider creates an image, song or search result. Each one is stored with its prompt and output hashes."
              action={{ href: "/audit", label: "See the activity log" }}
            />
          ) : (
            <div className="records">
              {generations.map((g) => {
                const isSelected = selected === g.id;
                return (
                  <article
                    key={g.id}
                    className={`record clickable ${isSelected ? "selected" : ""} fade-up`}
                    onClick={() => setSelected(g.id)}
                  >
                    <div className="ts">
                      {formatTimestamp(g.timestamp_ms)}
                      <em>
                        {toolLabel(g.kind.tool)}
                        {g.kind.model ? ` · ${g.kind.model}` : ""}
                      </em>
                    </div>
                    <div className="body">
                      <strong>{g.issuer.display}</strong>
                      <p className="hash">out · {shortHash(g.kind.output_sha256, 16)}</p>
                    </div>
                    {g.kind.assets[0] && (
                      <a
                        href={g.kind.assets[0]}
                        target="_blank"
                        rel="noreferrer"
                        className="btn link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        open asset
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
        <aside className="detail">
          {selectedGen ? (
            <>
              <div className="panel-head">
                <div>
                  <p className="eyebrow">provenance</p>
                  <h2>{toolLabel(selectedGen.kind.tool)}</h2>
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setSelected(null)}
                >
                  close
                </button>
              </div>
              <dl className="meta">
                <div>
                  <dt>event id</dt>
                  <dd className="mono">{selectedGen.id}</dd>
                </div>
                <div>
                  <dt>when</dt>
                  <dd>{formatDateTime(selectedGen.timestamp_ms)}</dd>
                </div>
                <div>
                  <dt>by</dt>
                  <dd>
                    {selectedGen.issuer.display}
                    <em>{shortPubkey(selectedGen.issuer.pubkey)}</em>
                  </dd>
                </div>
                <div>
                  <dt>model</dt>
                  <dd>{selectedGen.kind.model || "—"}</dd>
                </div>
                <div>
                  <dt>prompt sha256</dt>
                  <dd className="mono">{selectedGen.kind.prompt_sha256}</dd>
                </div>
                <div>
                  <dt>output sha256</dt>
                  <dd className="mono">{selectedGen.kind.output_sha256}</dd>
                </div>
                {selectedGen.kind.task_id && (
                  <div>
                    <dt>task id</dt>
                    <dd className="mono">{selectedGen.kind.task_id}</dd>
                  </div>
                )}
              </dl>
              {selectedGen.kind.assets.length > 0 && (
                <div className="assets">
                  <p className="eyebrow">assets</p>
                  <ul>
                    {selectedGen.kind.assets.map((a) => (
                      <li key={a}>
                        <a href={a} target="_blank" rel="noreferrer">
                          {a}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="empty">Pick a generation to see its provenance.</p>
          )}
        </aside>
      </section>
      </DataGate>

      <style jsx>{`
        .explorer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .explorer {
            grid-template-columns: 1fr;
          }
        }
        .detail {
          padding: 22px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--panel);
          position: sticky;
          top: 24px;
        }
        .meta {
          display: grid;
          gap: 12px;
          margin: 0 0 18px;
        }
        .meta div {
          display: grid;
          gap: 4px;
        }
        .meta dt {
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0;
        }
        .meta dd {
          margin: 0;
          color: var(--fg);
          font-size: 13px;
          word-break: break-all;
        }
        .meta dd.mono {
          font-family: var(--font-mono);
          font-size: 11.5px;
        }
        .meta dd em {
          display: block;
          margin-top: 2px;
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 11px;
          font-style: normal;
        }
        .hash {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--dim);
        }
        .assets ul {
          margin: 8px 0 0;
          padding: 0 0 0 18px;
        }
        .assets a {
          color: var(--fg);
          font-size: 12px;
          word-break: break-all;
        }
        .record.selected {
          border-color: var(--fg);
          background: var(--panel-hover);
        }
      `}</style>
    </>
  );
}
