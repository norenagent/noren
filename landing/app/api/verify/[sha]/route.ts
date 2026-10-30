import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const body = {
  error: "not_available_yet",
  message: "Robinhood Chain support is coming soon. This endpoint is not live.",
  chain: "robinhood-4663",
};

export function GET() {
  return NextResponse.json(body, { status: 501 });
}
