import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/compute-status", { title: "Compute status", section: "Compute" }, {
  title: "Compute status \u00b7 Noren",
  description: "Capacity, settlement reconciliation and reviewed incidents will be reported here once Compute is live on Robinhood Chain. Nothing is running today, so there is nothing to report.",
  alternates: { canonical: "/compute-status" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Compute"
      title="Compute status"
      lede="Capacity, settlement reconciliation and reviewed incidents will be reported here once Compute is live on Robinhood Chain. Nothing is running today, so there is nothing to report."
      points={["Capacity and journal health with scope and timestamp", "Independent reconciliation of settled payments", "Incident reviews published in full"]}
    />
  );
}
