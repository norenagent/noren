import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../server.js';
import { limited } from '../http.js';

describe('hosted mode', () => {
  it('does not list noren_pay_call and refuses it if called anyway', async () => {
    const server = buildServer({ env: {}, fetchImpl: vi.fn() as any, exposePay: false });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 't', version: '0' });
    await client.connect(b);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).not.toContain('noren_pay_call');
    expect(names).toHaveLength(8);
    const r: any = await client.callTool({ name: 'noren_pay_call', arguments: { slug: 'news' } });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/not available on the hosted endpoint/);
    await client.close();
  });
  it('local mode still lists all nine', async () => {
    const server = buildServer({ env: {}, fetchImpl: vi.fn() as any });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 't', version: '0' });
    await client.connect(b);
    expect((await client.listTools()).tools).toHaveLength(9);
    await client.close();
  });
});

describe('rate limiter', () => {
  it('allows 60 per window per ip then blocks, and resets', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 60; i++) expect(limited('1.2.3.4', t0)).toBe(false);
    expect(limited('1.2.3.4', t0)).toBe(true);
    expect(limited('5.6.7.8', t0)).toBe(false);
    expect(limited('1.2.3.4', t0 + 61_000)).toBe(false);
  });
});

describe('hosted tool descriptions', () => {
  it('no hosted tool description points at a tool the hosted list does not expose', async () => {
    const server = buildServer({ env: {}, fetchImpl: vi.fn() as any, exposePay: false });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: 't', version: '0' });
    await client.connect(b);
    const tools = (await client.listTools()).tools;
    const names = new Set(tools.map((t) => t.name));
    for (const t of tools) {
      for (const m of (t.description ?? '').match(/noren_[a-z_]+/g) ?? []) {
        expect(names.has(m), `${t.name} mentions ${m}`).toBe(true);
      }
    }
    await client.close();
  });
});
