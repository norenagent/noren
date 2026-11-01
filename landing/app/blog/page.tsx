import type { Metadata } from "next";
import { pageMetadata } from "@/app/_metadata";
import { ComingSoon } from "../_ComingSoon";

export const metadata: Metadata = pageMetadata("/blog", { title: "Blog" }, {
  title: "Blog",
  description: "Noren blog. Posts coming soon.",
  alternates: { canonical: "/blog" },
});

export default function BlogPage() {
  return (
    <ComingSoon
      eyebrow="Blog"
      title="Posts coming soon"
      lede="We have not published any posts yet. Notes from the Noren build will appear here."
    />
  );
}
