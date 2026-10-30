import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/compute-knowledge", { title: "Compute Knowledge", section: "Compute" }, {
  title: "Compute Knowledge \u00b7 Noren",
  description: "Compute Knowledge is a planned reference for what Compute can do and what each job costs. It will be published after Compute launches on Robinhood Chain.",
  alternates: { canonical: "/compute-knowledge" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Compute"
      title="Compute Knowledge"
      lede="Compute Knowledge is a planned reference for what Compute can do and what each job costs. It will be published after Compute launches on Robinhood Chain."
      points={["Plain-language guides to jobs and settlement", "Only measured figures, never estimates presented as results"]}
    />
  );
}
