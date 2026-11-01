import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/stake", { title: "Noren Stake" }, {
  title: "Noren Stake: Noren",
  description: "Staking for the Noren token is not live. The token contract is deployed on Robinhood Chain; no staking contract exists yet.",
  alternates: { canonical: "/stake" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Noren Stake"
      title="Stake the Noren token"
      lede="Staking is being rebuilt for Robinhood Chain. Nothing is live yet, so there is nothing to connect, deposit or claim today."
      points={[
        "Staking is only an idea at this stage; its terms are not decided",
    "Revenue is paid in the settlement asset on Robinhood Chain (USDG)",
    "Contract address and launch date will be published here first",
      ]}
    />
  );
}
