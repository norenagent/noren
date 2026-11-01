// Calls the REAL onRequestError from instrumentation.ts with the same arguments Next.js passes, and checks the file it writes.
// Run from the console directory: npx tsx scripts/hook-proof.mts
import { readFileSync, rmSync, existsSync } from "node:fs";

const dir = "/tmp/noren-hook-proof";
rmSync(dir, { recursive: true, force: true });
process.env.NOREN_ERROR_DIR = dir;
process.env.NEXT_RUNTIME = "nodejs";

const { onRequestError } = await import("../instrumentation.ts");

const boom = Object.assign(new TypeError("proof: deliberate failure with a hash 0xdeadbeefdeadbeefdeadbeef and a\nnewline"), { digest: "abc123" });
await onRequestError(
  boom,
  { path: "/api/noren/workspaces/run?token=SECRET123&x=1", method: "POST", headers: { cookie: "session=SECRET", authorization: "Bearer SECRET", "x-wallet-signature": "0xSECRETSIG" } },
  { routerKind: "App Router", routePath: "/api/noren/[...path]", routeType: "route", renderSource: undefined, revalidateReason: undefined },
);
// the edge runtime must be a no-op
process.env.NEXT_RUNTIME = "edge";
await onRequestError(new Error("edge must not write"), { path: "/x", method: "GET", headers: {} }, { routerKind: "App Router", routePath: "/x", routeType: "render" });

const f = dir + "/sandbox-web-errors.jsonl";
const raw = existsSync(f) ? readFileSync(f, "utf8") : "";
const lines = raw.trim().split("\n").filter(Boolean);
console.log("lines written:", lines.length, "(expect 1: the edge call writes nothing)");
console.log(lines[0]);
const rec = JSON.parse(lines[0]);
const bad = ["SECRET", "SECRET123", "deadbeefdeadbeefdeadbeef", "cookie", "authorization", "x-wallet", "?token"].filter((s) => raw.includes(s));
console.log("sensitive strings found in the file:", bad.length ? bad : "none");
console.log("fields:", Object.keys(rec).join(", "));
console.log("route is the pattern, not the URL with ids:", rec.route);
console.log("hash masked:", rec.message.includes("0x…"), "| newline collapsed:", !rec.message.includes("\n"));
rmSync(dir, { recursive: true, force: true });
