import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/live", { title: "Build log" }, {
  title: "Build log: Noren",
  description: "A public log of how Noren itself is built will appear here once the project publishes its own history.",
  alternates: { canonical: "/live" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Build log"
      title="Build log"
      lede="A public log of how Noren itself is built will appear here once the project publishes its own history."
      points={[
        "Every change recorded with its signed grant and receipt",
        "Nothing is shown until it is ours and real",
      ]}
    />
  );
}
