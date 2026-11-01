/**
 * Error capture for the sandbox console.
 *
 * Next.js calls `onRequestError` for every error thrown while rendering a page, a route handler or a server action.
 * We keep a bounded, de-duplicated record on disk so the watchdog can alert on it, and nothing leaves the machine.
 * No request body, header, cookie or query string is stored: only the route, the error name and a trimmed message.
 */
import type { Instrumentation } from "next";

export async function register() {
  // Nothing to set up at boot. The hook below does the work.
}

const MAX_MESSAGE = 240;

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // Only the Node runtime has a filesystem.
  if (process.env.NEXT_RUNTIME === "edge") return;
  try {
    const { appendFile, mkdir } = await import("node:fs/promises");
    const dir = process.env.NOREN_ERROR_DIR ?? "/var/lib/noren-monitor";
    await mkdir(dir, { recursive: true });
    const e = error as { name?: string; message?: string; digest?: string };
    const path = String(request.path ?? "").split("?")[0].slice(0, 120);
    const line = {
      t: Date.now(),
      service: "sandbox-web",
      route: String(context.routePath ?? path).slice(0, 120),
      kind: context.routeType,
      method: String(request.method ?? "").slice(0, 8),
      name: String(e?.name ?? "Error").slice(0, 60),
      message: String(e?.message ?? "").replace(/0x[0-9a-fA-F]{8,}/g, "0x…").replace(/\s+/g, " ").slice(0, MAX_MESSAGE),
      digest: e?.digest,
    };
    await appendFile(`${dir}/sandbox-web-errors.jsonl`, JSON.stringify(line) + "\n");
  } catch {
    // Monitoring must never be the thing that breaks a request.
  }
};
