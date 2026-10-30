import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/compute-prices", { title: "Compute prices", section: "Compute" }, {
  title: "Compute prices \u00b7 Noren",
  description: "Public GPU price history will appear here once Compute is live on Robinhood Chain. No prices are quoted today.",
  alternates: { canonical: "/compute-prices" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Compute"
      title="Compute prices"
      lede="Public GPU price history will appear here once Compute is live on Robinhood Chain. No prices are quoted today."
      points={["Prices quoted per second of use", "Every price observation will carry its scope and timestamp"]}
    />
  );
}
