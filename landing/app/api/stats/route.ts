import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Facts about the code in this repository, measured when the site was built.
// Nothing here is fetched from another project's repository.
const STATS = {
  crates: "50",
  tests: "3870",
  live: "486",
  primitives: "8",
};

export function GET() {
  return NextResponse.json(STATS, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
