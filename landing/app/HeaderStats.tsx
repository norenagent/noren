"use client";

import { useEffect, useState } from "react";

type Stats = { crates: string; tests: string; live: string; primitives: string };

function Cell({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-white/70 p-5">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className="text-[30px] font-bold leading-none tracking-[-0.02em] tabular-nums text-forest">{value}</span>
      <span className="text-[12.5px] text-muted-2">{note}</span>
    </div>
  );
}

/** Facts about the code in this repository, from /api/stats. Renders nothing until they arrive. */
export function HeaderStats() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d: Stats) => {
        if (alive) setS(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!s) return null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Cell label="Rust crates" value={s.crates} note="in the workspace" />
      <Cell label="Tests" value={Number(s.tests).toLocaleString("en-US")} note="discovered in source" />
      <Cell label="Live tests" value={s.live} note="against a running daemon" />
      <Cell label="Primitives" value={s.primitives} note="intent to settlement" />
    </div>
  );
}
