import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Wallet, verifyTypedData } from 'ethers';
import { buildServer, paymentRequest, submitPayment } from '../server.js';

const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const PAYEE = '0xA59b92F48E2525C364F7F54663b69da68Cd26529';
const BASE = 'https://gw.test';

const challenge = (over: Record<string, unknown> = {}) => ({
  x402Version: 1,
  accepts: [
    {
      scheme: 'exact',
      network: 'eip155:4663',
      maxAmountRequired: '10000',
      resource: `${BASE}/x402/api/news`,
      payTo: PAYEE,
      asset: USDG,
      extra: { name: 'COVENANT', version: '1', chainId: 4663, spender: PAYEE },
      ...over,
    },
  ],
});

function fakeFetch(opts: { allowance?: bigint; settle?: any; challengeOver?: Record<string, unknown>; apiStatus?: number } = {}) {
  const calls: { url: string; init?: any }[] = [];
  const fn = vi.fn(async (url: any, init?: any) => {
    const u = String(url);
    calls.push({ url: u, init });
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (u.endsWith('/x402/apis')) return json(200, { apis: [{ slug: 'news', price: '0.01' }] });
    if (u.endsWith('/x402/api/news')) {
      if (init?.headers?.['X-PAYMENT']) return json(opts.apiStatus ?? 200, { payload: { kind: 'news', items: [1, 2] } });
      return json(402, challenge(opts.challengeOver));
    }
    if (u.includes('/facilitator/settle')) return json(200, opts.settle ?? { success: true, transaction: '0x' + 'ab'.repeat(32), payment: 'receipt' });
    if (u.includes('rpc.mainnet.chain.robinhood.com')) return json(200, { jsonrpc: '2.0', id: 1, result: '0x' + (opts.allowance ?? 0n).toString(16).padStart(64, '0') });
    return json(404, {});
  });
  return { fn: fn as any, calls };
}

describe('hosted tool list', () => {
  it('exposes the two non-custodial payment tools and hides noren_pay_call', async () => {
    const server = buildServer({ env: {}, fetchImpl: vi.fn() as any, exposePay: false });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 't', version: '0' });
    await client.connect(b);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain('noren_payment_request');
    expect(names).toContain('noren_submit_payment');
    expect(names).not.toContain('noren_pay_call');
    await client.close();
  });
});

describe('noren_payment_request', () => {
  const payer = Wallet.createRandom();

  it('builds typed data that the payer can sign and that verifies', async () => {
    const { fn } = fakeFetch({ allowance: 0n });
    const r: any = await paymentRequest('news', payer.address, BASE, { fetchImpl: fn });
    const out = JSON.parse(r.content[0].text);
    expect(out.priceUsdg).toBe(0.01);
    expect(out.needsApprove).toBe(true);
    expect(out.approve.to).toBe(USDG);
    expect(out.approve.data.startsWith('0x095ea7b3')).toBe(true); // approve(address,uint256)
    expect(out.intent.to).toBe(PAYEE);
    expect(out.intent.value).toBe('10000');
    const { domain, types, message } = out.typedData;
    const sig = await payer.signTypedData(domain, types, message);
    expect(verifyTypedData(domain, types, message, sig).toLowerCase()).toBe(payer.address.toLowerCase());
  });

  it('skips the approve step when the allowance already covers the price', async () => {
    const { fn } = fakeFetch({ allowance: 10000n });
    const out = JSON.parse(((await paymentRequest('news', payer.address, BASE, { fetchImpl: fn })) as any).content[0].text);
    expect(out.needsApprove).toBe(false);
    expect(out.approve).toBeNull();
  });

  it('refuses another network, another asset and an overcharge', async () => {
    for (const over of [{ network: 'eip155:1' }, { asset: '0x' + '1'.repeat(40) }, { maxAmountRequired: '20000' }]) {
      const { fn } = fakeFetch({ challengeOver: over });
      await expect(paymentRequest('news', payer.address, BASE, { fetchImpl: fn })).rejects.toThrow();
    }
  });

  it('rejects an unknown slug', async () => {
    const { fn } = fakeFetch();
    await expect(paymentRequest('nope', payer.address, BASE, { fetchImpl: fn })).rejects.toThrow(/Unknown API slug/);
  });
});

describe('noren_submit_payment', () => {
  const payer = Wallet.createRandom();
  const mkIntent = (over: Record<string, unknown> = {}) => ({
    from: payer.address,
    to: PAYEE,
    value: '10000',
    validAfter: Math.floor(Date.now() / 1000) - 120,
    validBefore: Math.floor(Date.now() / 1000) + 300,
    nonce: '0x' + '11'.repeat(32),
    resource: `${BASE}/x402/api/news`,
    ...over,
  });
  const SIG = '0x' + '22'.repeat(65);
  const run = (intent: any, fetchImpl: any) =>
    submitPayment({ slug: 'news', intent, signature: SIG } as any, BASE, { fetchImpl });

  it('settles, redeems and returns the result with the transaction', async () => {
    const { fn, calls } = fakeFetch();
    const r: any = await run(mkIntent(), fn);
    expect(r.isError).toBeUndefined();
    const out = JSON.parse(r.content[0].text);
    expect(out.paidUsdg).toBe(0.01);
    expect(out.settlementTx).toMatch(/^0x[0-9a-f]{64}$/);
    expect(out.result.payload.kind).toBe('news');
    expect(calls.some((c) => c.url.includes('/facilitator/settle'))).toBe(true);
  });

  it.each([
    ['a different payee', { to: '0x' + '9'.repeat(40) }],
    ['a different amount', { value: '1' }],
    ['a different resource', { resource: 'https://evil.test/x' }],
    ['an expired request', { validBefore: Math.floor(Date.now() / 1000) - 5 }],
  ])('refuses %s and never calls the facilitator', async (_label, over) => {
    const { fn, calls } = fakeFetch();
    const r: any = await run(mkIntent(over as any), fn);
    expect(r.isError).toBe(true);
    expect(calls.some((c) => c.url.includes('/facilitator/settle'))).toBe(false);
  });

  it('surfaces a facilitator refusal as a clear error', async () => {
    const { fn } = fakeFetch({ settle: { success: false, errorReason: 'insufficient_allowance' } });
    const r: any = await run(mkIntent(), fn);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/insufficient_allowance/);
  });

  it('never needs or reads a private key', async () => {
    const { fn } = fakeFetch();
    const server = buildServer({ env: {}, fetchImpl: fn, exposePay: false });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 't', version: '0' });
    await client.connect(b);
    const r: any = await client.callTool({ name: 'noren_submit_payment', arguments: { slug: 'news', intent: mkIntent(), signature: SIG } });
    expect(r.isError).toBeUndefined();
    await client.close();
  });
});
