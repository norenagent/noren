"use client";

import { useEffect, useState } from "react";

const GATEWAY = "https://gateway.usenoren.xyz";
const EXPLORER = "https://robinhoodchain.blockscout.com";

type Rep = {
  address: string;
  score: number;
  tier: string;
  settledCount: number;
  totalUsdg: number;
  firstSeen: number | null;
  lastSeen?: number | null;
  txHashes?: string[];
};

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
// Records first seen before October 2026 were written while the gateway answered under an earlier host name.
const EARLIER_HOST_BEFORE = Date.UTC(2026, 9, 1);
const day = (t: number | null | undefined) => (t ? new Date(t).toISOString().slice(0, 10) : "n/a");
const TIER_STYLE: Record<string, string> = {
  established: "bg-lime text-forest",
  new: "bg-white text-muted ring-1 ring-forest/15",
  unknown: "bg-white text-muted ring-1 ring-forest/15",
};

function Tier({ tier }: { tier: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold ${TIER_STYLE[tier] ?? TIER_STYLE.new}`}>{tier}</span>
  );
}

function Card({ r }: { r: Rep }) {
  const tx = r.txHashes?.[r.txHashes.length - 1];
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-forest/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={`${EXPLORER}/address/${r.address}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[14px] font-semibold text-forest underline-offset-4 hover:underline">
          {short(r.address)}
        </a>
        <Tier tier={r.tier} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
        <div><dt className="text-muted">Score</dt><dd className="mt-1 text-[22px] font-extrabold text-forest">{r.score}</dd></div>
        <div><dt className="text-muted">Settled</dt><dd className="mt-1 text-[22px] font-extrabold text-forest">{r.settledCount}</dd></div>
        <div><dt className="text-muted">USDG paid</dt><dd className="mt-1 text-[22px] font-extrabold text-forest">{r.totalUsdg}</dd></div>
      </dl>
      <p className="mt-4 text-[12.5px] text-muted">
        First seen {day(r.firstSeen)}{r.lastSeen ? `, last ${day(r.lastSeen)}` : ""}
        {r.firstSeen && r.firstSeen < EARLIER_HOST_BEFORE ? (
          <span className="ml-2 inline-flex rounded-full bg-lime/60 px-2 py-0.5 text-[11px] font-bold text-forest" title="First recorded while the gateway used an earlier host name">earlier host</span>
        ) : null}
        {tx ? (
          <>
            {" "}·{" "}
            <a href={`${EXPLORER}/tx/${tx}`} target="_blank" rel="noopener noreferrer" className="font-mono underline-offset-4 hover:underline">
              latest tx {tx.slice(0, 10)}…
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

export function ReputationBoard() {
  const [rows, setRows] = useState<Rep[] | null>(null);
  const [total, setTotal] = useState<{ payers: number; settled: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch(`${GATEWAY}/reputation`).then((r) => r.json()),
      fetch(`${GATEWAY}/x402/leaderboard`).then((r) => r.json()),
    ])
      .then(([rep, lb]) => {
        if (!live) return;
        setRows((rep.leaderboard as Rep[]).slice().sort((a, b) => b.score - a.score));
        setTotal({ payers: lb.totalPayers, settled: lb.totalSettled });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return <p className="rounded-2xl bg-white p-6 text-[15px] text-muted ring-1 ring-forest/10">The gateway did not answer. Try again in a minute.</p>;
  if (!rows) return <p className="rounded-2xl bg-white p-6 text-[15px] text-muted ring-1 ring-forest/10" aria-busy="true">Reading the gateway…</p>;
  return (
    <div>
      {total ? (
        <p className="text-[14px] text-fg-soft">
          <strong className="text-forest">{total.payers}</strong> payers · <strong className="text-forest">{total.settled}</strong> settled payments, read live from the gateway.
        </p>
      ) : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.address} r={r} />
        ))}
      </div>
    </div>
  );
}

export function ReputationLookup() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Rep | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function look(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const a = value.trim();
    if (!ADDRESS.test(a)) {
      setError("That is not a 42-character 0x address.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await fetch(`${GATEWAY}/reputation?address=${a}`);
      const j = await r.json();
      if (!j.queried) throw new Error("no record");
      setResult(j.queried as Rep);
    } catch {
      setError("The gateway did not return a record. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={look} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="rep-address">Wallet address</label>
        <input
          id="rep-address"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0x… wallet address"
          spellCheck={false}
          autoComplete="off"
          className="min-h-[48px] flex-1 rounded-full bg-white px-5 font-mono text-[14px] text-fg ring-1 ring-forest/15 outline-none focus:ring-2 focus:ring-forest"
        />
        <button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Looking…" : "Look up"}</button>
      </form>
      {error ? <p role="alert" className="mt-3 text-[14px] font-semibold text-[#a3341c]">{error}</p> : null}
      {result ? (
        <div className="mt-5">
          <Card r={result} />
          {result.tier === "unknown" ? (
            <p className="mt-3 text-[13.5px] text-muted">No settled payment from this address has been seen. That is a fact about this gateway only, not a verdict on the address.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
