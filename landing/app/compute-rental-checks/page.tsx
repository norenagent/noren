import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/compute-rental-checks", { title: "GPU rental checks", section: "Compute" }, {
  title: "GPU rental checks \u00b7 Noren",
  description: "Scheduled checks that rent a GPU, run a probe and reconcile the settlement are planned for after launch. No checks have run on Robinhood Chain.",
  alternates: { canonical: "/compute-rental-checks" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Compute"
      title="GPU rental checks"
      lede="Scheduled checks that rent a GPU, run a probe and reconcile the settlement are planned for after launch. No checks have run on Robinhood Chain."
      points={["A real rental, a GPU probe and a reconciled payment each time", "Results published with timestamps, failures included"]}
    />
  );
}
