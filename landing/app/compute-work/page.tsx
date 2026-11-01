import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/compute-work", { title: "Compute pool pilot", section: "Compute" }, {
  title: "Compute pool pilot \u00b7 Noren",
  description: "A pilot where operators take paid work from a pool is planned. It has not started on Robinhood Chain and no work, payments or operators are listed here.",
  alternates: { canonical: "/compute-work" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Compute"
      title="Compute pool pilot"
      lede="A pilot where operators take paid work from a pool is planned. It has not started on Robinhood Chain and no work, payments or operators are listed here."
      points={["Work is funded before an operator accepts it", "Operator stake locked while serving", "Pilot results will be published here with their evidence"]}
    />
  );
}
