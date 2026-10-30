import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/verify", { title: "Verification" }, {
  title: "Verification: Noren",
  description: "Commit verification is coming soon on Robinhood Chain.",
  alternates: { canonical: "/verify" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Verification"
      title="Verify a commit"
      lede="Commit verification records will be published once the on-chain anchor is available on Robinhood Chain."
      points={[
        "Transparency-log entry and audit chain per commit",
    "On-chain anchor and verifier signature",
      ]}
    />
  );
}
