import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const TITLE = "SDK";
const DESCRIPTION =
  "The Noren TypeScript SDK for Noren's EVM protocol surface on Robinhood Chain. Prepare contract calls with viem, expose tools over MCP, and pay over x402 with EIP-3009. Contracts are not deployed yet.";

export const metadata: Metadata = pageMetadata("/sdk", { title: "Noren SDK" }, {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/sdk" },
  openGraph: { type: "website", url: "https://usenoren.xyz/sdk", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
});

const eyebrow = "text-[13px] font-semibold text-muted";
const paragraph = "text-[13px] leading-relaxed text-fg-soft sm:text-[14px]";
const cmdBlock =
  "block overflow-x-auto whitespace-pre rounded-2xl bg-raised px-5 py-4 font-mono text-[12.5px] leading-relaxed text-fg sm:text-[13px]";
const link =
  "underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-fg-soft";

const DOES: { title: string; body: string }[] = [
  {
    title: "Prepare instructions",
    body: "Build viem-ready contract calls for the Robinhood Chain protocol surface (reputation, bonded receipts, bounded-spend escrow, trade guard). You sign and send with your own wallet; the SDK never holds a key. Addresses will be published when the contracts are live.",
  },
  {
    title: "Expose tools over MCP",
    body: "Turn those prepared calls into MCP tools any agent client can reach, so a Claude or Codex agent can transact on the protocol without bespoke glue.",
  },
  {
    title: "Settle over x402",
    body: "Make and take capability-scoped, pay-per-call requests over x402, settled in USDG with an EIP-3009 transferWithAuthorization signed by your wallet.",
  },
];

export default function SdkPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl px-5 pb-24 pt-[88px] sm:px-8 sm:pt-[120px]">
        <p className={eyebrow}>typescript · robinhood chain · x402</p>
        <h1 className="page-title mt-4 text-fg">SDK</h1>
        <p className={`${paragraph} mt-5 max-w-2xl`}>
          The Noren SDK is the TypeScript
          SDK for Noren&apos;s Robinhood Chain-native protocol surface. It prepares the contract calls (EVM, viem),
          exposes them as agent tools, and settles over x402, so you build on the protocol without wiring
          the low-level calls by hand.
        </p>

        <section className="mt-10">
          <p className={eyebrow}>Install</p>
          <code className={`${cmdBlock} mt-3`}># not published yet; build from the source tree
# then: npm i viem</code>
          <p className={`${paragraph} mt-6 max-w-2xl`}>
            A sketch of the intended shape. The SDK is a work in progress and the contract
            addresses are placeholders until launch on Robinhood Chain (chain id 4663).
          </p>
          <code className={`${cmdBlock} mt-3`}>
            {`import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.AGENT_KEY as \`0x\${string}\`);
const wallet = createWalletClient({ account, transport: http(RPC_URL) });

// EIP-3009: sign a USDG transferWithAuthorization for one x402 call.
// The facilitator submits it; your key never leaves the process.
const signature = await wallet.signTypedData({
  domain: { name: "USDG", version: "1", chainId: 4663, verifyingContract: USDG },
  types: { TransferWithAuthorization: [/* from, to, value, validAfter, validBefore, nonce */] },
  primaryType: "TransferWithAuthorization",
  message,
});`}
          </code>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {DOES.map((d) => (
            <div key={d.title} className="rounded-3xl bg-raised p-6 shadow-[0_12px_32px_-16px_rgba(31,71,35,0.18)]">
              <h2 className="text-[18px] font-extrabold tracking-tight text-fg">{d.title}</h2>
              <p className={`${paragraph} mt-3 text-muted`}>{d.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-12">
          <p className={eyebrow}>Source and reference</p>
          <p className={`${paragraph} mt-3 max-w-2xl`}>
            The SDK lives in the monorepo under packages/sdk. Source repository: coming soon. The wire format it speaks is documented in the{" "}
            <a className={link} href="https://docs.usenoren.xyz/http-api">
              HTTP API reference
            </a>
            , with the full docs at{" "}
            <a className={link} href="https://docs.usenoren.xyz">
              docs.usenoren.xyz
            </a>
            .
          </p>
        </section>
      </main>
      <SiteFooter className="pb-8" />
    </>
  );
}
