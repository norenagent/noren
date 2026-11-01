import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/compute-workspaces", { title: "Compute workspaces", section: "Compute" }, {
  title: "Compute workspaces \u00b7 Noren",
  description: "Encrypted, portable workspaces that move between GPU leases are planned. They are not available on Robinhood Chain yet.",
  alternates: { canonical: "/compute-workspaces" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Compute"
      title="Compute workspaces"
      lede="Encrypted, portable workspaces that move between GPU leases are planned. They are not available on Robinhood Chain yet."
      points={["Workspace archives encrypted before they leave your machine", "Verified cleanup after each lease", "Install steps will appear here when it ships"]}
    />
  );
}
