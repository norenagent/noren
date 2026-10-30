import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/compute-inference", { title: "Compute inference", section: "Compute" }, {
  title: "Compute inference \u00b7 Noren",
  description: "Pay-per-call model inference settled in USDG on Robinhood Chain is planned. There is no public inference endpoint yet.",
  alternates: { canonical: "/compute-inference" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Compute"
      title="Inference over x402"
      lede="Pay-per-call model inference settled in USDG on Robinhood Chain is planned. There is no public inference endpoint yet."
      points={["Each request is paid with a signed EIP-3009 authorization", "Receipts hashed into the daemon's audit log", "Endpoints and supported models will be listed here when live"]}
    />
  );
}
