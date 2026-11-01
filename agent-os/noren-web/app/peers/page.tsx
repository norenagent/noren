"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { shortPubkey } from "@/lib/format";
import { SAMPLE_PROMPTS, setPrefill } from "@/lib/mytasks";
import { usePoll } from "@/lib/usePoll";
import { CopyButton, DataGate, EmptyState, Tile, When } from "@/lib/ui";
import { PageHeader } from "../components/PageHeader";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

type Status = "" | "live" | "revoked";

async function loadPeers(prefix: string, status: Status) {
  return api.listPeers(50, prefix || undefined, status || undefined);
}

export default function AgentsPage() {
  const router = useRouter();
  const [prefix, setPrefix] = useState("");
  const [status, setStatus] = useState<Status>("");
  const fetcher = useCallback(() => loadPeers(prefix, status), [prefix, status]);
  const { data, error, lastSyncMs, refresh } = usePoll(fetcher, 5000);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotatedToken, setRotatedToken] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const peers = data?.peers ?? [];
  const operatorPubkey = data?.operator_pubkey_b58 ?? "";
  const truncated = data?.truncated === true;
  const active = peers.filter((p) => p.revoked_at === null);

  async function onRotate() {
    if (!window.confirm("Rotate your sign-in key? Your old key stops working right away.")) return;
    setRotating(true);
    setErrMsg(null);
    try {
      const r = await api.rotateOperatorToken();
      if (r.kind === "operator_token_rotated") {
        setRotatedToken(r.token_b58);
        refresh();
      } else {
        setErrMsg(r.message);
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRotating(false);
    }
  }

  async function onRevoke(tokenPrefix: string, display: string) {
    if (!window.confirm(`Revoke ${display}? They won't be able to connect again. This can't be undone.`)) return;
    setRevoking(tokenPrefix);
    setErrMsg(null);
    try {
      const r = await api.revokePeer(tokenPrefix);
      if (r.kind === "error") setErrMsg(r.message);
      else if (r.outcome.type === "ambiguous") setErrMsg("Couldn't tell which agent you meant. Try a longer key prefix.");
      else if (r.outcome.type === "not_found") setErrMsg("Couldn't find an agent with that key prefix.");
      refresh();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Who you trust"
        title="Agents"
        subhead="One built-in assistant runs here. Below it are the signing keys that can sign permissions and the log. Revoked keys stay listed so the record stays intact."
        syncMs={lastSyncMs}
        error={error}
        right={
          !DEMO_MODE ? (
            <button type="button" className="btn" onClick={onRotate} disabled={rotating}>
              {rotating ? "Rotating…" : "Rotate your sign-in key"}
            </button>
          ) : undefined
        }
      />

      <section className="panel assistant-card" aria-label="Sandbox Assistant">
        <div className="a-head">
          <div className="avatar big" aria-hidden>
            S
          </div>
          <div>
            <h2>Sandbox Assistant</h2>
            <p className="text-muted">
              A small rule-based program running locally in this sandbox. It is not an AI language
              model: it recognises a fixed set of requests and answers them exactly.
            </p>
          </div>
          <span className="badge-soft">Built in</span>
        </div>
        <p className="eyebrow" style={{ margin: "16px 0 8px" }}>
          What it can do. Press “Try it” to fill the composer on the Overview.
        </p>
        <ul className="skill-list">
          {SAMPLE_PROMPTS.map((s) => (
            <li key={s.skill}>
              <div>
                <strong>{s.skill}</strong>
                <span className="text-muted"> · {s.what}</span>
                <code>{s.prompt}</code>
              </div>
              <button
                type="button"
                className="btn small"
                aria-label={`Try it: ${s.prompt}`}
                onClick={() => {
                  setPrefill(s.prompt);
                  router.push("/");
                }}
              >
                Try it
              </button>
            </li>
          ))}
        </ul>
      </section>

      {rotatedToken && (
        <article className="panel" style={{ marginBottom: 20 }}>
          <p className="eyebrow">Your new sign-in key</p>
          <p className="text-muted">Save this somewhere safe. You&apos;ll need it to connect from another shell or device.</p>
          <input readOnly value={rotatedToken} onFocus={(e) => e.currentTarget.select()} style={{ width: "100%" }} aria-label="New sign-in key" />
          <div className="actions-row" style={{ marginTop: 10 }}>
            <CopyButton value={rotatedToken} />
            <button type="button" className="btn ghost small" onClick={() => setRotatedToken(null)}>
              Dismiss
            </button>
          </div>
        </article>
      )}

      {errMsg && <p className="empty" role="alert" style={{ marginBottom: 16 }}>{errMsg}</p>}

      <DataGate loading={!data} error={error} onRetry={refresh} rows={3}>
        <section className="metric-row">
          <Tile label="Signing keys" value={active.length} caption="the operator key that signs permissions and the log" />
          <Tile label="Revoked keys" value={peers.length - active.length} caption="kept for the record" />
          <Tile label="Operator key" small value={operatorPubkey ? shortPubkey(operatorPubkey) : "–"} caption="signs permissions and the log" />
          <Tile label="Messages" small value={<Link href="/queues" className="onchain-link">View</Link>} caption="agent-to-agent traffic" />
        </section>

        <section className="panel filter-panel">
          <div className="filters">
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Search by key prefix"
              aria-label="Search by key prefix"
            />
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Filter by status">
              <option value="">All agents</option>
              <option value="live">Active</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </section>

        {peers.length === 0 ? (
          <EmptyState
            title="No connected agents match"
            body="Clear the search or the status filter. Agents appear here once they register with the sandbox."
          />
        ) : (
          <div className="peer-grid">
            {peers.map((peer) => {
              const isSelf = operatorPubkey !== "" && peer.agent_id.pubkey === operatorPubkey;
              const live = peer.revoked_at === null;
              return (
                <article key={`${peer.token_prefix}:${peer.registered_at}`} className={live ? "peer live" : "peer revoked"}>
                  <div className="head">
                    <div className="avatar" aria-hidden>
                      {peer.agent_id.display.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{peer.agent_id.display}</strong>
                      <p className="text-mono">{shortPubkey(peer.agent_id.pubkey)}</p>
                    </div>
                  </div>
                  <dl>
                    <div>
                      <dt>Key</dt>
                      <dd className="text-mono">{peer.token_prefix}…</dd>
                    </div>
                    <div>
                      <dt>Connected</dt>
                      <dd>
                        <When ms={peer.registered_at} />
                      </dd>
                    </div>
                  </dl>
                  <footer>
                    <span className={`badge-soft ${live ? "" : "dim"}`}>
                      {live ? (isSelf ? "Operator key" : "Active key") : "Revoked"}
                    </span>
                    <CopyButton value={peer.agent_id.pubkey} label="Copy key" />
                    {live && !isSelf && !DEMO_MODE && (
                      <button
                        type="button"
                        className="btn link"
                        onClick={() => onRevoke(peer.token_prefix, peer.agent_id.display)}
                        disabled={revoking === peer.token_prefix}
                      >
                        {revoking === peer.token_prefix ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {truncated && (
          <p className="text-muted" style={{ marginTop: 12 }}>
            Showing the first {peers.length}. Narrow with a key prefix to see more.
          </p>
        )}
      </DataGate>

      <style jsx>{`
        .assistant-card {
          margin-bottom: 20px;
        }
        .a-head {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
        }
        .a-head > div:nth-child(2) {
          flex: 1 1 260px;
          min-width: 0;
        }
        .a-head h2 {
          margin: 0 0 4px;
          font-size: 19px;
          color: var(--forest);
        }
        .a-head p {
          margin: 0;
          max-width: 62ch;
        }
        .avatar {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--dim);
          font-size: 13px;
          font-weight: 600;
          flex: 0 0 auto;
        }
        .avatar.big {
          width: 44px;
          height: 44px;
          background: var(--sunken);
          color: var(--forest);
          font-size: 18px;
          font-weight: 700;
        }
        .skill-list {
          display: grid;
          gap: 8px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .skill-list li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          border: 1px solid var(--border-soft);
          border-radius: 14px;
        }
        .skill-list li > div {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .skill-list code {
          width: fit-content;
          max-width: 100%;
          padding: 2px 8px;
          border-radius: 8px;
          background: var(--sunken);
          font-size: 12.5px;
          overflow-wrap: anywhere;
        }
        .filter-panel {
          margin-bottom: 20px;
          padding: 14px 18px;
        }
        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .filters input {
          flex: 1 1 200px;
          max-width: 100%;
        }
        .filters select {
          flex: 0 1 160px;
        }
        .peer-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
          gap: 12px;
        }
        .peer {
          display: grid;
          gap: 14px;
          min-width: 0;
          padding: 16px 18px;
          border: 1px solid var(--border-soft);
          border-radius: var(--radius);
          background: var(--panel);
        }
        .peer.revoked {
          opacity: 0.75;
        }
        .peer .head {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .peer strong {
          display: block;
          font-size: 15px;
        }
        .peer .head p {
          margin: 3px 0 0;
          font-size: 12px;
          color: var(--muted);
        }
        .peer dl {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 0;
        }
        .peer dt {
          color: var(--muted);
          font-size: 12px;
        }
        .peer dd {
          margin: 4px 0 0;
          font-size: 13px;
        }
        .peer footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-top: 10px;
          border-top: 1px solid var(--border-soft);
        }
      `}</style>
    </>
  );
}
