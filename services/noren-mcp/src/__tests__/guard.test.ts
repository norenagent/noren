import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TOOLS, VERSION, buildServer, callTool, today, verdictFor } from '../server.js';

const BASE = 'https://gateway.usenoren.xyz';
const ADDR = '0xA59b92F48E2525C364F7F54663b69da68Cd26529';
const ledger = () => ({ day: today(), spent: 0 });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fake(opts: { rep?: unknown; repStatus?: number; rpcFail?: boolean; balanceWei?: string; nonce?: number } = {}) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: any, init?: any) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('/reputation/')) return json(opts.rep ?? {}, opts.repStatus ?? 200);
    if (u.includes('/x402/apis')) return json({ apis: [{ slug: 'news', path: '/x402/api/news', price: 0.01 }] });
    if (u.includes('/x402/stats')) return json({ apis: 5, settled: 3 });
    if (u.includes('rpc.mainnet.chain.robinhood.com')) {
      if (opts.rpcFail) throw new Error('rpc down');
      const { method } = JSON.parse(init.body);
      if (method === 'eth_getBalance') return json({ jsonrpc: '2.0', id: 1, result: opts.balanceWei ?? '0xde0b6b3a7640000' });
      if (method === 'eth_getTransactionCount') return json({ jsonrpc: '2.0', id: 1, result: '0x' + (opts.nonce ?? 7).toString(16) });
    }
    return json({}, 404);
  });
  return { fn: fn as any, calls };
}

async function connect(fetchImpl: any, exposePay = false) {
  const server = buildServer({ env: {}, fetchImpl, exposePay });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 't', version: '0' });
  await client.connect(b);
  return client;
}

const check = async (fetchImpl: any, address = ADDR) => {
  const r = await callTool('noren_check_counterparty', { address }, { env: {}, fetchImpl, ledger: ledger() });
  return { r, out: r.isError ? null : JSON.parse(r.content[0].text) };
};

describe('noren_check_counterparty', () => {
  it('rates known_good at >=5 settled and score >=40', async () => {
    const { fn } = fake({ rep: { score: 54, tier: 'established', settledCount: 13, totalUsdg: 0.25, firstSeen: 1788370951564, lastSeen: 1788544365547 } });
    const { out } = await check(fn);
    expect(out.verdict).toBe('known_good');
    expect(out.score).toBe(54);
    expect(out.settledCount).toBe(13);
    expect(out.firstSeen).toBe(new Date(1788370951564).toISOString());
    expect(out.txCount).toBe(7);
    expect(out.ethBalance).toBe('1.0');
    expect(out.caveat).toMatch(/only payments settled through the Noren gateway/);
    expect(out.caveat).toMatch(/not a guarantee/);
    expect(out.reasons.length).toBeGreaterThan(1);
  });
  it('rates limited_history for 1-4 settled, and for many settled with a low score', async () => {
    const { out } = await check(fake({ rep: { score: 10, tier: 'new', settledCount: 2, totalUsdg: 0.02, firstSeen: 1, lastSeen: 2 } }).fn);
    expect(out.verdict).toBe('limited_history');
    expect(verdictFor(9, 39)).toBe('limited_history');
    expect(verdictFor(4, 90)).toBe('limited_history');
    expect(verdictFor(5, 40)).toBe('known_good');
    expect(verdictFor(0, 0)).toBe('unknown');
  });
  it('rates unknown for a 404', async () => {
    const { out } = await check(fake({ repStatus: 404, nonce: 0, balanceWei: '0x0' }).fn);
    expect(out.verdict).toBe('unknown');
    expect(out.settledCount).toBe(0);
    expect(out.firstSeen).toBeNull();
    expect(out.lastSeen).toBeNull();
    expect(out.txCount).toBe(0);
  });
  it('rates unknown for a 200 with zero settled', async () => {
    const { out } = await check(fake({ rep: { score: 0, tier: 'unknown', settledCount: 0, totalUsdg: 0, firstSeen: null } }).fn);
    expect(out.verdict).toBe('unknown');
    expect(out.firstSeen).toBeNull();
  });
  it('rejects a bad address before any network call', async () => {
    const { fn } = fake();
    const { r } = await check(fn, 'not-an-address');
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/Invalid arguments/);
    expect(fn).not.toHaveBeenCalled();
  });
  it('degrades gracefully when the RPC fails', async () => {
    const { out } = await check(fake({ rpcFail: true, rep: { score: 54, tier: 'established', settledCount: 13, totalUsdg: 0.25, firstSeen: 1, lastSeen: 2 } }).fn);
    expect(out.verdict).toBe('known_good');
    expect(out.txCount).toBeNull();
    expect(out.ethBalance).toBeNull();
    expect(out.caveat).toMatch(/RPC was unreachable/);
    expect(out.reasons.join(' ')).toMatch(/Chain RPC lookup failed/);
  });
  it('does not claim a verdict when the gateway is down', async () => {
    const { out } = await check(fake({ repStatus: 500 }).fn);
    expect(out.verdict).toBe('unknown');
    expect(out.caveat).toMatch(/could not be read/);
  });
  it('is available on the hosted list', async () => {
    const client = await connect(fake().fn, false);
    expect((await client.listTools()).tools.map((t) => t.name)).toContain('noren_check_counterparty');
    await client.close();
  });
});

describe('resources', () => {
  it('lists apis and stats plus the wallet template', async () => {
    const client = await connect(fake().fn);
    const res = await client.listResources();
    expect(res.resources.map((r) => r.uri).sort()).toEqual(['noren://apis', 'noren://stats']);
    expect(res.resources.every((r) => r.mimeType === 'application/json')).toBe(true);
    const tpl = await client.listResourceTemplates();
    expect(tpl.resourceTemplates[0].uriTemplate).toBe('noren://wallet/{address}');
    await client.close();
  });
  it('reads apis, stats and a wallet', async () => {
    const { fn } = fake({ rep: { address: ADDR, score: 54, settledCount: 13 } });
    const client = await connect(fn);
    const apis: any = await client.readResource({ uri: 'noren://apis' });
    expect(apis.contents[0].mimeType).toBe('application/json');
    expect(JSON.parse(apis.contents[0].text).apis[0].slug).toBe('news');
    const stats: any = await client.readResource({ uri: 'noren://stats' });
    expect(JSON.parse(stats.contents[0].text).network).toBe('eip155:4663');
    const w: any = await client.readResource({ uri: `noren://wallet/${ADDR}` });
    expect(JSON.parse(w.contents[0].text).score).toBe(54);
    await client.close();
  });
  it('turns a wallet 404 into an unknown reputation', async () => {
    const client = await connect(fake({ repStatus: 404 }).fn);
    const w: any = await client.readResource({ uri: `noren://wallet/${ADDR}` });
    expect(JSON.parse(w.contents[0].text).tier).toBe('unknown');
    await client.close();
  });
  it('errors clearly on unknown URIs and bad addresses without calling the network', async () => {
    const { fn } = fake();
    const client = await connect(fn);
    await expect(client.readResource({ uri: 'noren://nope' })).rejects.toThrow(/Unknown resource URI/);
    await expect(client.readResource({ uri: 'noren://wallet/0x123' })).rejects.toThrow(/Invalid wallet address/);
    await expect(client.readResource({ uri: 'https://example.com' })).rejects.toThrow(/Unknown resource URI/);
    expect(fn).not.toHaveBeenCalled();
    await client.close();
  });
});

describe('prompts', () => {
  const PAYER = '0xEAaBd1997d4Bd739620323F1fAb25D700043a6D5';
  it('lists both prompts', async () => {
    const client = await connect(fake().fn);
    expect((await client.listPrompts()).prompts.map((p) => p.name).sort()).toEqual(['buy_api', 'check_before_paying']);
    await client.close();
  });
  it('buy_api embeds the args and the safe flow', async () => {
    const client = await connect(fake().fn);
    const p = await client.getPrompt({ name: 'buy_api', arguments: { slug: 'news', payer: PAYER } });
    const text = (p.messages[0].content as any).text as string;
    expect(p.messages[0].role).toBe('user');
    for (const w of ['noren_list_apis', 'noren_payment_request', 'noren_submit_payment', 'noren_verify_payment', 'news', PAYER, 'yes', 'eth_signTypedData_v4']) expect(text).toContain(w);
    expect(text).not.toMatch(/0x[0-9a-fA-F]{64}/);
    await client.close();
  });
  it('check_before_paying mentions the guard tool and 3 lines', async () => {
    const client = await connect(fake().fn);
    const p = await client.getPrompt({ name: 'check_before_paying', arguments: { address: ADDR } });
    const text = (p.messages[0].content as any).text as string;
    expect(text).toContain('noren_check_counterparty');
    expect(text).toContain('3 lines');
    await client.close();
  });
  it('errors on missing or bad args and unknown prompts', async () => {
    const client = await connect(fake().fn);
    await expect(client.getPrompt({ name: 'buy_api', arguments: { slug: 'news' } })).rejects.toThrow(/payer/);
    await expect(client.getPrompt({ name: 'buy_api', arguments: { slug: 'News!', payer: PAYER } })).rejects.toThrow(/slug/);
    await expect(client.getPrompt({ name: 'check_before_paying', arguments: {} })).rejects.toThrow(/address/);
    await expect(client.getPrompt({ name: 'nope' })).rejects.toThrow(/Unknown prompt/);
    await client.close();
  });
});

describe('annotations and server info', () => {
  it('every tool has a title and all four hints', () => {
    for (const t of TOOLS) {
      expect(t.title, t.name).toBeTruthy();
      expect(t.annotations, t.name).toBeTruthy();
      for (const k of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) expect(typeof t.annotations![k], `${t.name}.${k}`).toBe('boolean');
    }
  });
  it('read tools are read-only and idempotent; pay tools are not read-only', () => {
    const by = Object.fromEntries(TOOLS.map((t) => [t.name, t.annotations!]));
    for (const n of ['noren_gateway_stats', 'noren_list_apis', 'noren_reputation', 'noren_leaderboard', 'noren_verify_payment', 'noren_check_counterparty', 'noren_payment_request']) {
      expect(by[n].readOnlyHint, n).toBe(true);
      expect(by[n].idempotentHint, n).toBe(true);
    }
    for (const n of ['noren_submit_payment', 'noren_pay_call']) {
      expect(by[n].readOnlyHint, n).toBe(false);
      expect(by[n].destructiveHint, n).toBe(false);
      expect(by[n].idempotentHint, n).toBe(false);
      expect(by[n].openWorldHint, n).toBe(true);
    }
  });
  it('annotations survive the hosted list; server reports version and instructions', async () => {
    const client = await connect(fake().fn, false);
    const tools = (await client.listTools()).tools;
    expect(tools.every((t) => t.title && t.annotations)).toBe(true);
    expect(client.getServerVersion()?.version).toBe(VERSION);
    expect(VERSION).toBe('0.3.0');
    expect(client.getInstructions()).toMatch(/noren_check_counterparty/);
    expect(client.getServerCapabilities()).toMatchObject({ tools: {}, resources: {}, prompts: {} });
    await client.close();
  });
  it('mentions no forbidden words in the new surface', () => {
    const text = JSON.stringify(TOOLS).toLowerCase();
    // Each name is written with one letter in a character class, so the words never appear in this file.
    expect(text).not.toMatch(/c[l]uster|f[i]nchagentic|v[i]key|t[o]talum|s[o]lana/);
  });
});
