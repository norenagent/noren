import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/privacy", { title: "Privacy" }, {
  title: "Privacy: Noren",
  description: "Noren is pre-release and has no published privacy policy yet. This page states what the current demo does and does not collect.",
  alternates: { canonical: "/privacy" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Legal"
      title="Privacy"
      lede="Noren is pre-release and has no published privacy policy yet. This page states what the current demo does and does not collect."
      points={[
        "The sandbox stores the tasks sent to it on the server and resets them every 12 hours",
        "Tasks you send are kept in your own browser as well, and are never sent anywhere else by this site",
        "The site does not use advertising trackers; the host may log basic request data",
      ]}
    />
  );
}
