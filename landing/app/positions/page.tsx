import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/positions", { title: "Positions" }, {
  title: "Positions: Noren",
  description: "Staking positions are coming soon on Robinhood Chain.",
  alternates: { canonical: "/positions" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Noren Stake"
      title="Your positions"
      lede="Positions will appear here once staking launches on Robinhood Chain."
      points={[
        "View locked amount, unlock date and accrued revenue",
    "Withdraw principal after the lock ends",
      ]}
    />
  );
}
