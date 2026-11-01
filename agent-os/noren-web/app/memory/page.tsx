"use client";

import { useCallback, useState, type FormEvent } from "react";
import { api, type Memory } from "@/lib/api";
import { memoryTierLabel } from "@/lib/labels";
import { usePoll } from "@/lib/usePoll";
import { CopyButton, DataGate, EmptyState, Tile, When, friendlyError } from "@/lib/ui";
import { isRedacted } from "@/lib/mytasks";
import { PageHeader } from "../components/PageHeader";

type Tier = "" | "working" | "episodic" | "longterm";

const PAGE = 20;

function MemoryText({ m }: { m: Memory }) {
  if (isRedacted(m.text) || m.text.startsWith("[redacted")) {
    return (
      <p className="text-muted">
        <em>Content hidden in the public sandbox.</em> Notes are private to protect visitors; only
        the fact that a note was saved is shown.
      </p>
    );
  }
  return <p>{m.text}</p>;
}

export default function MemoryPage() {
  const [tier, setTier] = useState<Tier>("");
  const [shown, setShown] = useState(PAGE);
  const fetcher = useCallback(() => api.recentMemory(100, tier || undefined), [tier]);
  const { data, error, lastSyncMs, refresh } = usePoll(fetcher, 5000);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Memory[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const onSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setErrMsg(null);
    try {
      const r = await api.searchMemory(query.trim(), 10);
      setHits(r.records);
    } catch (err) {
      setErrMsg(friendlyError(err instanceof Error ? err.message : String(err)));
    } finally {
      setSearching(false);
    }
  };

  const records = data?.records ?? [];
  const count = (t: string) => records.filter((r) => r.tier === t).length;

  return (
    <>
      <PageHeader
        eyebrow="What agents remember"
        title="Memory"
        subhead="Notes the assistant has saved, for example when you send “remember buy milk”. They come in three kinds: short-term, task notes and long-term."
        syncMs={lastSyncMs}
        error={error}
      />

      <DataGate loading={!data} error={error} onRetry={refresh} rows={4}>
        <section className="metric-row">
          <Tile label={memoryTierLabel("working")} value={count("working")} caption="what the agent is working on now" />
          <Tile label={memoryTierLabel("episodic")} value={count("episodic")} caption="tied to a task or chat" />
          <Tile label={memoryTierLabel("longterm")} value={count("longterm")} caption="kept across sessions" />
          <Tile label="Total shown" value={records.length} caption="most recent 100" />
        </section>

        <section className="panel" style={{ marginBottom: 20 }}>
          <form onSubmit={onSearch} className="search-form">
            <label htmlFor="mem-q" className="eyebrow">
              Search memory
            </label>
            <div className="search-row">
              <input
                id="mem-q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for?"
              />
              <button type="submit" className="btn primary" disabled={!query.trim() || searching}>
                {searching ? "Searching…" : "Search"}
              </button>
            </div>
          </form>
          {errMsg && <p className="form-error-line">{errMsg}</p>}
          {hits != null && (
            <div style={{ marginTop: 16 }}>
              <div className="panel-head">
                <h2>
                  Search results <span className="count">{hits.length}</span>
                </h2>
                <button type="button" className="btn ghost small" onClick={() => setHits(null)}>
                  Clear
                </button>
              </div>
              {hits.length === 0 ? (
                <p className="empty">Nothing matched. Try a different word, or save a note first.</p>
              ) : (
                <div className="records">
                  {hits.map((m) => (
                    <article key={m.id} className="record">
                      <div className="ts">{memoryTierLabel(m.tier)}</div>
                      <div className="body">
                        <MemoryText m={m} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>
              Saved notes <span className="count">{records.length}</span>
            </h2>
            <label className="inline-select">
              <span className="text-muted">Show</span>
              <select
                value={tier}
                onChange={(e) => {
                  setTier(e.target.value as Tier);
                  setShown(PAGE);
                }}
                aria-label="Filter by kind"
              >
                <option value="">All kinds</option>
                <option value="working">{memoryTierLabel("working")}</option>
                <option value="episodic">{memoryTierLabel("episodic")}</option>
                <option value="longterm">{memoryTierLabel("longterm")}</option>
              </select>
            </label>
          </div>
          {records.length === 0 ? (
            <EmptyState
              title="Nothing saved yet"
              body="Notes appear here when the assistant saves something. Try sending “remember buy milk” from the Overview."
              action={{ href: "/", label: "Go to Overview" }}
            />
          ) : (
            <>
              <div className="records">
                {records.slice(0, shown).map((m) => (
                  <article key={m.id} className="record">
                    <div className="ts">
                      <When ms={m.created_at} block />
                    </div>
                    <div className="body">
                      <strong>{memoryTierLabel(m.tier)}</strong>
                      <MemoryText m={m} />
                    </div>
                    <div className="right">
                      <CopyButton value={m.id} label="Copy id" />
                    </div>
                  </article>
                ))}
              </div>
              {records.length > shown && (
                <div className="more-row">
                  <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>
                    Show more ({records.length - shown} left)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </DataGate>

      <style jsx>{`
        .search-form {
          display: grid;
          gap: 10px;
        }
        .search-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
        }
        .inline-select {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .form-error-line {
          margin: 10px 0 0;
          color: var(--tone-danger);
          font-size: 14px;
        }
      `}</style>
    </>
  );
}
