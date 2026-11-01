"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { NOREN_TOKEN } from "./_brand";

/** The Noren token contract in the footer of every page: full address, click to copy, link to the explorer. */
export function FooterCA({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(NOREN_TOKEN.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <span className="flex max-w-full flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy the Noren token contract address"
        title={copied ? "Copied" : "Copy"}
        className="ca-pill inline-flex max-w-full items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[12px] font-semibold transition-colors"
      >
        <span className="break-all text-left">{NOREN_TOKEN.address}</span>
        {copied ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
      </button>
      <a
        href={NOREN_TOKEN.explorer}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-[12px] font-semibold underline-offset-4 hover:underline ${tone === "dark" ? "text-[#c4edc9] hover:text-white" : "text-forest"}`}
      >
        Explorer
      </a>
    </span>
  );
}
