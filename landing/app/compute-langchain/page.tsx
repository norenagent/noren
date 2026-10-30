import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/compute-langchain", { title: "Compute for LangChain", section: "Compute" }, {
  title: "Compute for LangChain \u00b7 Noren",
  description: "A LangChain tool that pays for Compute work over x402 is planned. It is not released yet and there is nothing to install today.",
  alternates: { canonical: "/compute-langchain" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Compute"
      title="LangChain integration"
      lede="A LangChain tool that pays for Compute work over x402 is planned. It is not released yet and there is nothing to install today."
      points={["Pay-per-call settlement in USDG", "Hard spend caps per run", "Install steps will appear here when it ships"]}
    />
  );
}
