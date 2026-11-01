import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "@/app/_ComingSoon";

export const metadata: Metadata = pageMetadata("/terms", { title: "Terms of service" }, {
  title: "Terms of service: Noren",
  description: "Noren is pre-release and has no published terms of service yet. They will appear here before anything is offered as a paid or hosted service.",
  alternates: { canonical: "/terms" },
});

export default function Page() {
  return (
    <ComingSoon
      eyebrow="Legal"
      title="Terms of service"
      lede="Noren is pre-release and has no published terms of service yet. They will appear here before anything is offered as a paid or hosted service."
      points={[
        "The public sandbox is a demo: shared state, resets every 12 hours, no guarantees",
        "Do not submit personal, confidential or sensitive information to the sandbox",
        "The source code is open under the Apache License 2.0",
      ]}
    />
  );
}
