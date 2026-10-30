import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "../_ComingSoon";

export const metadata: Metadata = pageMetadata("/changelog", { title: "Changelog" }, {
  title: "Changelog: Noren",
  description: "Noren is pre-release. A changelog starts with our first release.",
  alternates: { canonical: "/changelog" },
});

export default function ChangelogPage() {
  return (
    <ComingSoon
      eyebrow="Changelog"
      title="Changelog"
      lede="Noren is pre-release. A changelog starts with our first release."
    />
  );
}
