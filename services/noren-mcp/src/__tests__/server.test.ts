import { describe, expect, it, vi } from 'vitest';
import { id } from 'ethers';
import { TOOLS, TRANSFER_TOPIC, callTool, checkCaps, readCaps, redact, today, buildServer, verifyOnChain } from '../server.js';

const ADDR = '0xEAaBd1997d4Bd739620323F1fAb25D700043a6D5';
const TX = '0x1e59c8be4814425b50fc7f23688f0dc8ad7695a8d24485546872970c46ec09dd';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const ledger = () => ({ day: today(), spent: 0 });

describe('tool list', () => {
  it('exposes exactly the nine live tools with object schemas', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      'noren_check_counterparty',
      'noren_gateway_stats',
      'noren_leaderboard',
      'noren_list_apis',
      'noren_pay_call',
      'noren_payment_request',
      'noren_reputation',
      'noren_submit_payment',
      'noren_verify_payment',
    ]);
    for (const t of TOOLS) {
      expect(t.inputSchema.type).toBe('object');
      expect(t.description.length).toBeGreaterThan(40);
    }
  });
  it('never mentions things that are not live', () => {
    const text = JSON.stringify(TOOLS).toLowerCase();
    for (const word of ['solana', 'covenant', 'usdc', 'gpu', 'staking', 'escrow']) expect(text).not.toContain(word);
  });
  it('builds a server object', () => {
    expect(buildServer({ env: {}, fetchImpl: vi.fn() as any })).toBeTruthy();
  });
});

describe('read tools', () => {
  it('reputation returns the gateway body for a valid address', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ address: ADDR, score: 30, tier: 'new', settledCount: 1 }));
    const r = await callTool('noren_reputation', { address: ADDR }, { env: {}, fetchImpl: fetchImpl as any, ledger: ledger() });
    expect(r.isError).toBeUndefined();
    expect(JSON.parse(r.content[0].text).tier).toBe('new');
    expect(fetchImpl.mock.calls[0][0]).toBe(`https://gateway.usenoren.xyz/reputation/${ADDR}`);
  });
  it('reputation 404 is a clean unknown, not an error', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 404));
    const r = await callTool('noren_reputation', { address: ADDR }, { env: {}, fetchImpl: fetchImpl as any, ledger: ledger() });
    expect(JSON.parse(r.content[0].text).tier).toBe('unknown');
  });
  it('rejects a malformed address before any network call', async () => {
    const fetchImpl = vi.fn();
    const r = await callTool('noren_reputation', { address: '../../etc/passwd' }, { env: {}, fetchImpl: fetchImpl as any, ledger: ledger() });
    expect(r.isError).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('leaderboard honours the limit', async () => {
    const payers = Array.from({ length: 30 }, (_, i) => ({ payer: '0x' + String(i).padStart(40, '0') }));
    const fetchImpl = vi.fn(async () => jsonResponse({ payers }));
    const r = await callTool('noren_leaderboard', { limit: 3 }, { env: {}, fetchImpl: fetchImpl as any, ledger: ledger() });
    expect(JSON.parse(r.content[0].text).payers).toHaveLength(3);
  });
  it('gateway errors surface as tool errors', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503));
    const r = await callTool('noren_gateway_stats', {}, { env: {}, fetchImpl: fetchImpl as any, ledger: ledger() });
    expect(r.isError).toBe(true);
  });
  it('unknown tool is an error', async () => {
    const r = await callTool('nope', {}, { env: {}, fetchImpl: vi.fn() as any, ledger: ledger() });
    expect(r.isError).toBe(true);
  });
  it('a custom gateway url is honoured and trailing slash trimmed', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ apis: [] }));
    await callTool('noren_list_apis', {}, { env: { NOREN_GATEWAY_URL: 'https://example.test/' }, fetchImpl: fetchImpl as any, ledger: ledger() });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://example.test/x402/apis');
  });
});

describe('on-chain verification', () => {
  it('the Transfer topic is the real keccak256 of the event signature', () => {
    expect(TRANSFER_TOPIC).toBe(id('Transfer(address,address,uint256)'));
  });
  it('reads USDG transfers out of a receipt', async () => {
    const pad = (a: string) => '0x' + '0'.repeat(24) + a.slice(2).toLowerCase();
    const receipt = {
      status: '0x1',
      blockNumber: '0x6071bc9',
      logs: [
        {
          address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
          topics: [TRANSFER_TOPIC, pad(ADDR), pad('0xA59b92F48E2525C364F7F54663b69da68Cd26529')],
          data: '0x' + (10000).toString(16).padStart(64, '0'),
        },
        { address: '0x0000000000000000000000000000000000000001', topics: [], data: '0x' },
      ],
    };
    const fetchImpl = vi.fn(async () => jsonResponse({ jsonrpc: '2.0', id: 1, result: receipt }));
    const out: any = await verifyOnChain(TX, { fetchImpl: fetchImpl as any });
    expect(out.success).toBe(true);
    expect(out.usdgTransfers).toEqual([{ from: ADDR.toLowerCase(), to: '0xa59b92f48e2525c364f7f54663b69da68cd26529', usdg: 0.01 }]);
  });
  it('reports a missing receipt', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ jsonrpc: '2.0', id: 1, result: null }));
    const out: any = await verifyOnChain(TX, { fetchImpl: fetchImpl as any });
    expect(out.found).toBe(false);
  });
  it('rejects a bad hash', async () => {
    const r = await callTool('noren_verify_payment', { tx_hash: '0x12' }, { env: {}, fetchImpl: vi.fn() as any, ledger: ledger() });
    expect(r.isError).toBe(true);
  });
});

describe('spending limits', () => {
  const caps = { perCall: 0.05, perDay: 0.1 };
  it('blocks when caps are not configured', () => {
    expect(checkCaps(0.01, { perCall: 0, perDay: 0 }, ledger())).toMatch(/not set/);
  });
  it('blocks a price above the per-call cap', () => {
    expect(checkCaps(0.06, caps, ledger())).toMatch(/per-call cap/);
  });
  it('blocks when the daily cap would be exceeded and resets on a new day', () => {
    expect(checkCaps(0.05, caps, { day: today(), spent: 0.08 })).toMatch(/Daily cap/);
    expect(checkCaps(0.05, caps, { day: '2000-01-01', spent: 99 })).toBeNull();
  });
  it('allows a price inside both caps', () => {
    expect(checkCaps(0.01, caps, { day: today(), spent: 0.02 })).toBeNull();
  });
  it('reads caps from the environment and ignores junk', () => {
    expect(readCaps({ NOREN_MAX_USDG_PER_CALL: '0.05', NOREN_MAX_USDG_PER_DAY: '0.1' })).toEqual({ perCall: 0.05, perDay: 0.1 });
    expect(readCaps({ NOREN_MAX_USDG_PER_CALL: 'abc' })).toEqual({ perCall: 0, perDay: 0 });
  });
});

describe('noren_pay_call', () => {
  const apis = { apis: [{ slug: 'news', path: '/news', price: '0.01' }, { slug: 'signals', path: '/signals', price: '0.05' }] };
  const gw = (url: string) => (String(url).endsWith('/x402/apis') ? jsonResponse(apis) : jsonResponse({}, 404));

  it('refuses without a payer key and never calls pay', async () => {
    const pay = vi.fn();
    const r = await callTool('noren_pay_call', { slug: 'news' }, { env: {}, fetchImpl: vi.fn(async (u: any) => gw(u)) as any, ledger: ledger(), pay });
    expect(r.isError).toBe(true);
    expect(pay).not.toHaveBeenCalled();
  });
  it('refuses without caps', async () => {
    const pay = vi.fn();
    const r = await callTool('noren_pay_call', { slug: 'news' }, { env: { NOREN_PAYER_KEY: '0x' + '11'.repeat(32) }, fetchImpl: vi.fn(async (u: any) => gw(u)) as any, ledger: ledger(), pay });
    expect(r.content[0].text).toMatch(/caps are not set/);
    expect(pay).not.toHaveBeenCalled();
  });
  it('refuses an unknown slug', async () => {
    const pay = vi.fn();
    const env = { NOREN_PAYER_KEY: '0x' + '11'.repeat(32), NOREN_MAX_USDG_PER_CALL: '0.05', NOREN_MAX_USDG_PER_DAY: '0.1' };
    const r = await callTool('noren_pay_call', { slug: 'nothing' }, { env, fetchImpl: vi.fn(async (u: any) => gw(u)) as any, ledger: ledger(), pay });
    expect(r.isError).toBe(true);
    expect(pay).not.toHaveBeenCalled();
  });
  it('takes the price from the gateway list, not from arguments, and tracks the daily total', async () => {
    const pay = vi.fn(async (a: any) => ({ result: { ok: true }, txHash: '0xabc', paidUsdg: a.priceUsdg }));
    const env = { NOREN_PAYER_KEY: '0x' + '11'.repeat(32), NOREN_MAX_USDG_PER_CALL: '0.05', NOREN_MAX_USDG_PER_DAY: '0.06' };
    const l = ledger();
    const deps = { env, fetchImpl: vi.fn(async (u: any) => gw(u)) as any, ledger: l, pay };
    const ok = await callTool('noren_pay_call', { slug: 'signals', extra_price: 0 }, deps);
    expect(ok.isError).toBeUndefined();
    expect(pay.mock.calls[0][0].priceUsdg).toBe(0.05);
    expect(l.spent).toBeCloseTo(0.05);
    const over = await callTool('noren_pay_call', { slug: 'news' }, deps);
    expect(over.isError).toBeUndefined();
    const blocked = await callTool('noren_pay_call', { slug: 'news' }, deps);
    expect(blocked.content[0].text).toMatch(/Daily cap/);
    expect(pay).toHaveBeenCalledTimes(2);
  });
  it('a price above the per-call cap is refused before paying', async () => {
    const pay = vi.fn();
    const env = { NOREN_PAYER_KEY: '0x' + '11'.repeat(32), NOREN_MAX_USDG_PER_CALL: '0.02', NOREN_MAX_USDG_PER_DAY: '1' };
    const r = await callTool('noren_pay_call', { slug: 'signals' }, { env, fetchImpl: vi.fn(async (u: any) => gw(u)) as any, ledger: ledger(), pay });
    expect(r.content[0].text).toMatch(/per-call cap/);
    expect(pay).not.toHaveBeenCalled();
  });
  it('errors never contain the payer key', async () => {
    const key = '0x' + 'ab'.repeat(32);
    const pay = vi.fn(async () => {
      throw new Error(`boom with ${key}`);
    });
    const env = { NOREN_PAYER_KEY: key, NOREN_MAX_USDG_PER_CALL: '0.05', NOREN_MAX_USDG_PER_DAY: '1' };
    const r = await callTool('noren_pay_call', { slug: 'news' }, { env, fetchImpl: vi.fn(async (u: any) => gw(u)) as any, ledger: ledger(), pay });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).not.toContain(key);
    expect(r.content[0].text).not.toContain('ab'.repeat(32));
  });
  it('redact strips the key with and without 0x', () => {
    const key = '0x' + 'cd'.repeat(32);
    expect(redact(`a ${key} b ${key.slice(2)}`, { NOREN_PAYER_KEY: key })).toBe('a <redacted-key> b <redacted-key>');
  });
});
