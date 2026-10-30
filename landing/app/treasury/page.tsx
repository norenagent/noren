import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/treasury", { title: "Treasury" }, {
  title: "Treasury: Noren",
  description: "The public treasury dashboard is coming soon on Robinhood Chain.",
  alternates: { canonical: "/treasury" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Noren Stake"
      title="Treasury"
      lede="A public, read-only view of the treasury may be published once contracts exist on Robinhood Chain. Nothing is decided yet."
      points={[
        "Cumulative distributions, protocol holdings and active stakers",
    "Every figure will link to a transaction on the chain explorer",
    "No numbers are shown until they are real",
      ]}
    />
  );
}
