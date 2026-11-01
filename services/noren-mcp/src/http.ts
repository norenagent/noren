#!/usr/bin/env node
import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServer, TOOLS, RESOURCES, RESOURCE_TEMPLATES, PROMPTS, VERSION } from './server.js';

// Hosted, stateless Streamable HTTP endpoint. No key ever exists in this process, so
// noren_pay_call is removed. Paying works non-custodially: noren_payment_request builds
// the typed data, the caller's wallet signs, noren_submit_payment settles it.
const HOSTED_TOOLS = TOOLS.filter((t) => t.name !== 'noren_pay_call').map((t) => t.name);
const PORT = Number(process.env.PORT ?? '4320');
const HOST = process.env.HOST ?? '127.0.0.1';
const MAX_BODY = 64 * 1024;
const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.RATE_LIMIT_PER_MIN ?? '60');
const hits = new Map<string, { n: number; reset: number }>();

export function limited(ip: string, now = Date.now()): boolean {
  const e = hits.get(ip);
  if (!e || now > e.reset) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  e.n += 1;
  return e.n > LIMIT;
}

function send(res: import('node:http').ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
  res.end(JSON.stringify(body));
}

const http = createServer(async (req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  if (url === '/health') return send(res, 200, { ok: true, name: 'noren-mcp', tools: HOSTED_TOOLS.length, version: VERSION });
  if (url !== '/mcp' && url !== '/') return send(res, 404, { error: 'not found' });
  if (req.method === 'GET' && url === '/') {
    return send(res, 200, {
      name: 'Noren MCP',
      version: VERSION,
      transport: 'streamable-http',
      endpoint: '/mcp',
      tools: HOSTED_TOOLS,
      resources: [...RESOURCES.map((r) => r.uri), ...RESOURCE_TEMPLATES.map((r) => r.uriTemplate)],
      prompts: PROMPTS.map((p) => p.name),
      docs: 'https://usenoren.xyz/docs/mcp',
    });
  }
  if (req.method !== 'POST') return send(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed. POST JSON-RPC to /mcp.' }, id: null }, { allow: 'POST' });
  const ip = String(req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? 'unknown');
  if (limited(ip)) return send(res, 429, { jsonrpc: '2.0', error: { code: -32000, message: 'Rate limit: 60 requests per minute.' }, id: null }, { 'retry-after': '60' });

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) return send(res, 413, { jsonrpc: '2.0', error: { code: -32000, message: 'Request too large.' }, id: null });
    chunks.push(c as Buffer);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return send(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null });
  }
  const server = buildServer({ env: { NOREN_GATEWAY_URL: process.env.NOREN_GATEWAY_URL ?? 'https://gateway.usenoren.xyz' }, exposePay: false });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    if (!res.headersSent) send(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    console.error('mcp request failed:', (error as Error).message);
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
}, WINDOW_MS).unref();

function isEntrypoint(): boolean {
  // run directly or through npm's .bin symlink; importing this file (tests) must not open a port
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  http.listen(PORT, HOST, () => console.log(`noren-mcp http listening on ${HOST}:${PORT}`));
}
