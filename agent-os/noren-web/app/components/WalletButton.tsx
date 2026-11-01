"use client";

import { shortAddress, useWallet } from "@/lib/wallet";

/** Sidebar wallet control: connect, sign in, or the connected address. */
export function WalletButton() {
  const w = useWallet();
  if (!w.enabled) return null;

  if (!w.connected) {
    return (
      <button type="button" className="wallet-btn wallet-cta" onClick={w.start}>
        <WalletIcon />
        <span>Connect wallet</span>
      </button>
    );
  }

  if (!w.ready) {
    return (
      <div className="wallet-stack">
        <button type="button" className="wallet-btn wallet-cta" onClick={w.start} disabled={w.signing}>
          <WalletIcon />
          <span>{w.signing ? "Check your wallet…" : "Sign to continue"}</span>
        </button>
        {w.error && <p className="wallet-err">{w.error}</p>}
      </div>
    );
  }

  return (
    <div className="wallet-row">
      <button type="button" className="wallet-btn" onClick={w.openAccount} title="Wallet and network">
        <span className="wallet-dot" aria-hidden />
        <span className="wallet-addr">{shortAddress(w.address)}</span>
        <span className="wallet-net">4663</span>
      </button>
      <button type="button" className="wallet-out" onClick={w.disconnect} aria-label="Disconnect wallet" title="Disconnect">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
        </svg>
      </button>
    </div>
  );
}

function WalletIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h12a2 2 0 0 1 2 2v2.5M3.5 7.5V17a2 2 0 0 0 2 2H19a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 19 8H6a2.5 2.5 0 0 1-2.5-.5zM16 13.5h.01" />
    </svg>
  );
}
