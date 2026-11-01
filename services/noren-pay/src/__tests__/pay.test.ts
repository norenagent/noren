import { describe, it, expect, vi } from 'vitest';
import { createNorenPay, NorenPayError, USDG, CHAIN } from '../index.js';

// Throwaway key, never funded. Address is irrelevant; tests never reach a real RPC for the refusal paths.
const KEY = '0x' + '11'.repeat(32);
const SPENDER = '0x' + 'ab'.repeat(20);
const PAY_TO = '0x' + 'cd'.repeat(20);

function challenge(over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: CHAIN,
        asset: USDG,
        payTo: PAY_TO,
        maxAmountRequired: '10000',
        resource: 'https://gateway.usenoren.xyz/x402/api/alerts',
        extra: { spender: SPENDER, name: 'COVENANT', version: '1', chainId: 4663, ...extra },
        ...over,
      },
    ],
  };
}
const catalog = (price = '0.01') => ({ apis: [{ slug: 'alerts', path: '/alerts', price, description: 'x', payTo: PAY_TO }] });

function mockFetch(c: unknown, cat: unknown, status = 402) {
  return vi.fn(async (url: any) => {
    const u = String(url);
    if (u.endsWith('/x402/apis')) return new Response(JSON.stringify(cat), { status: 200 });
    if (u.includes('/x402/api/')) return new Response(JSON.stringify(c), { status });
    return new Response('{}', { status: 500 });
  }) as unknown as typeof fetch;
}
const make = (f: typeof fetch, o: Record<string, unknown> = {}) => createNorenPay({ privateKey: KEY, fetch: f, ...o });
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'no-error';
  } catch (e) {
    return e instanceof NorenPayError ? e.code : 'other:' + String(e);
  }
};

describe('input validation', () => {
  it('rejects a malformed key', () => {
    expect(() => createNorenPay({ privateKey: 'nope' })).toThrow(NorenPayError);
  });
  it('rejects a slug that could escape the path', async () => {
    const pay = make(mockFetch(challenge(), catalog()));
    expect(await codeOf(pay.fetchPaid('../admin'))).toBe('bad_slug');
    expect(await codeOf(pay.fetchPaid('Alerts'))).toBe('bad_slug');
  });
});

describe('refuses before any money moves', () => {
  it('non-402 response', async () => {
    expect(await codeOf(make(mockFetch({}, catalog(), 200)).fetchPaid('alerts'))).toBe('not_402');
  });
  it('wrong network', async () => {
    expect(await codeOf(make(mockFetch(challenge({ network: 'eip155:1' }), catalog())).fetchPaid('alerts'))).toBe('wrong_network');
  });
  it('wrong asset', async () => {
    expect(await codeOf(make(mockFetch(challenge({ asset: '0x' + '22'.repeat(20) }), catalog())).fetchPaid('alerts'))).toBe('wrong_asset');
  });
  it('missing spender', async () => {
    expect(await codeOf(make(mockFetch(challenge({}, { spender: undefined }), catalog())).fetchPaid('alerts'))).toBe('bad_spender');
  });
  it('challenge asks more than the catalog lists', async () => {
    expect(await codeOf(make(mockFetch(challenge({ maxAmountRequired: '50000' }), catalog('0.01')), { maxPerCallUsdg: 1 }).fetchPaid('alerts'))).toBe('overcharge');
  });
  it('slug not in catalog', async () => {
    expect(await codeOf(make(mockFetch(challenge(), { apis: [] })).fetchPaid('alerts'))).toBe('unknown_api');
  });
  it('per-call cap', async () => {
    expect(await codeOf(make(mockFetch(challenge(), catalog()), { maxPerCallUsdg: 0.005 }).fetchPaid('alerts'))).toBe('cap_per_call');
  });
  it('per-day cap', async () => {
    expect(await codeOf(make(mockFetch(challenge(), catalog()), { maxPerDayUsdg: 0.005 }).fetchPaid('alerts'))).toBe('cap_per_day');
  });
  it('never POSTs to the facilitator when it refuses', async () => {
    const f = mockFetch(challenge({ network: 'eip155:1' }), catalog());
    await codeOf(make(f).fetchPaid('alerts'));
    const posted = (f as any).mock.calls.some((c: any[]) => String(c[0]).includes('/facilitator/settle'));
    expect(posted).toBe(false);
  });
});

describe('catalog', () => {
  it('lists apis', async () => {
    const apis = await make(mockFetch(challenge(), catalog())).listApis();
    expect(apis[0].slug).toBe('alerts');
  });
});
