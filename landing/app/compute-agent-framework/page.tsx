import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/compute-agent-framework", { title: "Compute for agent frameworks", section: "Compute" }, {
  title: "Compute for agent frameworks \u00b7 Noren",
  description: "A client for agent frameworks that pays for Compute calls with x402 is planned. It is not released for Robinhood Chain yet, and there is no package to install today.",
  alternates: { canonical: "/compute-agent-framework" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Compute"
      title="Agent framework integration"
      lede="A client for agent frameworks that pays for Compute calls with x402 is planned. It is not released for Robinhood Chain yet, and there is no package to install today."
      points={["Pay-per-call requests settled in USDG", "A spend budget the agent cannot exceed", "Release notes and install steps will appear here when it ships"]}
    />
  );
}
