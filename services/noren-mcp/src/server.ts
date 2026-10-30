#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Wallet, JsonRpcProvider, Contract } from 'ethers';

type TextContent = { type: 'text'; text: string };
export type ToolResult = { content: TextContent[]; isError?: boolean };
type Fetch = typeof fetch;
type ToolInputSchema = Tool['inputSchema'];

export const DEFAULT_GATEWAY = 'https://gateway.usenoren.xyz';
export const CHAIN = 'eip155:4663';
export const RPC_URL = 'https://rpc.mainnet.chain.robinhood.com';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

const reputationSchema = z.object({ address: z.string().regex(ADDRESS) });
const txSchema = z.object({ tx_hash: z.string().regex(TX_HASH) });
const listSchema = z.object({});
const leaderboardSchema = z.object({ limit: z.number().int().positive().max(50).optional() });
const payCallSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
});

function describeTool(name: string, description: string, inputSchema: ToolInputSchema): Tool {
  return { name, description, inputSchema };
}

const addressProp = { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$', description: 'EVM address (0x...)' };

export const TOOLS: Tool[] = [
  describeTool(
    'noren_gateway_stats',
    'Live gateway statistics: how many paid APIs, 402 challenges, and settled USDG payments on Robinhood Chain (eip155:4663), read from the gateway.',
    { type: 'object', properties: {}, additionalProperties: false },
  ),
  describeTool(
    'noren_list_apis',
    'List the pay-per-call APIs the gateway sells, with their path and price in USDG. Use a slug from this list with noren_pay_call.',
    { type: 'object', properties: {}, additionalProperties: false },
  ),
  describeTool(
    'noren_reputation',
    'Reputation of an EVM wallet computed only from payments that settled on Robinhood Chain: score, tier, settled count, total USDG and the transaction hashes behind it.',
    { type: 'object', properties: { address: addressProp }, required: ['address'], additionalProperties: false },
  ),
  describeTool(
    'noren_leaderboard',
    'Top paying wallets by settled count, from the gateway leaderboard.',
    { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } }, additionalProperties: false },
  ),
  describeTool(
    'noren_verify_payment',
    'Check a payment on Robinhood Chain directly from the chain RPC: whether the transaction succeeded and the USDG Transfer events it contains. Does not trust the gateway.',
    {
      type: 'object',
      properties: { tx_hash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$', description: 'Transaction hash' } },
      required: ['tx_hash'],
      additionalProperties: false,
    },
  ),
  describeTool(
    'noren_pay_call',
    'Call one paid gateway API and pay for it in USDG over x402 on Robinhood Chain. The price comes from the gateway list, never from arguments. Requires NOREN_PAYER_KEY in the client environment, a per-call cap (NOREN_MAX_USDG_PER_CALL) and a daily cap (NOREN_MAX_USDG_PER_DAY). Returns the API result and the settlement transaction.',
    {
      type: 'object',
      properties: { slug: { type: 'string', pattern: '^[a-z0-9-]+$', description: 'API slug from noren_list_apis' } },
      required: ['slug'],
      additionalProperties: false,
    },
  ),
];

export function asText(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export function asError(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function gatewayUrl(env: NodeJS.ProcessEnv): string {
  return (env.NOREN_GATEWAY_URL ?? DEFAULT_GATEWAY).replace(/\/+$/, '');
}

/** Remove anything that looks like a key or the configured payer key from text. */
export function redact(input: string, env: NodeJS.ProcessEnv): string {
  let out = input;
  const key = env.NOREN_PAYER_KEY?.trim();
  if (key) {
    out = out.split(key).join('<redacted-key>');
    out = out.split(key.replace(/^0x/, '')).join('<redacted-key>');
  }
  return out;
}

async function getJson(url: string, deps: { fetchImpl: Fetch }): Promise<{ status: number; body: any }> {
  const response = await deps.fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': 'noren-mcp/0.1' } });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, body };
}

// ---- spending limits -------------------------------------------------------
export type Ledger = { day: string; spent: number };
export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
export function readCaps(env: NodeJS.ProcessEnv): { perCall: number; perDay: number } {
  const perCall = Number(env.NOREN_MAX_USDG_PER_CALL ?? '0');
  const perDay = Number(env.NOREN_MAX_USDG_PER_DAY ?? '0');
  return { perCall: Number.isFinite(perCall) ? perCall : 0, perDay: Number.isFinite(perDay) ? perDay : 0 };
}
export function checkCaps(price: number, caps: { perCall: number; perDay: number }, ledger: Ledger, now = new Date()): string | null {
  if (!(caps.perCall > 0) || !(caps.perDay > 0)) {
    return 'Spending caps are not set. Set NOREN_MAX_USDG_PER_CALL and NOREN_MAX_USDG_PER_DAY (both > 0) to enable payments.';
  }
  if (price > caps.perCall) return `Price ${price} USDG exceeds the per-call cap ${caps.perCall} USDG.`;
  const spent = ledger.day === today(now) ? ledger.spent : 0;
  if (spent + price > caps.perDay + 1e-9) return `Daily cap ${caps.perDay} USDG would be exceeded (spent today ${spent}).`;
  return null;
}

// ---- tool handlers ---------------------------------------------------------
export async function callTool(
  name: string,
  rawArgs: unknown,
  deps: { env: NodeJS.ProcessEnv; fetchImpl: Fetch; ledger: Ledger; pay?: PayFn },
): Promise<ToolResult> {
  const base = gatewayUrl(deps.env);
  try {
    switch (name) {
      case 'noren_gateway_stats': {
        listSchema.parse(rawArgs ?? {});
        const r = await getJson(`${base}/x402/stats`, deps);
        if (r.status !== 200) return asError(`Gateway returned HTTP ${r.status} for /x402/stats.`);
        return asText({ network: CHAIN, ...r.body });
      }
      case 'noren_list_apis': {
        listSchema.parse(rawArgs ?? {});
        const r = await getJson(`${base}/x402/apis`, deps);
        if (r.status !== 200) return asError(`Gateway returned HTTP ${r.status} for /x402/apis.`);
        return asText(r.body);
      }
      case 'noren_reputation': {
        const { address } = reputationSchema.parse(rawArgs);
        const r = await getJson(`${base}/reputation/${address}`, deps);
        if (r.status === 404) return asText({ address, score: 0, tier: 'unknown', settledCount: 0, note: 'No settled payments recorded for this wallet.' });
        if (r.status !== 200) return asError(`Gateway returned HTTP ${r.status} for the reputation lookup.`);
        return asText(r.body);
      }
      case 'noren_leaderboard': {
        const { limit } = leaderboardSchema.parse(rawArgs ?? {});
        const r = await getJson(`${base}/x402/leaderboard`, deps);
        if (r.status !== 200) return asError(`Gateway returned HTTP ${r.status} for the leaderboard.`);
        const payers = Array.isArray(r.body?.payers) ? r.body.payers.slice(0, limit ?? 10) : [];
        return asText({ payers });
      }
      case 'noren_verify_payment': {
        const { tx_hash } = txSchema.parse(rawArgs);
        return asText(await verifyOnChain(tx_hash, deps));
      }
      case 'noren_pay_call': {
        const { slug } = payCallSchema.parse(rawArgs);
        if (!deps.pay) return asError('Payments are disabled in this build.');
        return await payCall(slug, base, deps as Required<typeof deps>);
      }
      default:
        return asError(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof z.ZodError ? `Invalid arguments: ${error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}` : (error as Error).message;
    return asError(redact(message, deps.env));
  }
}

// keccak256("Transfer(address,address,uint256)"); pinned by a test that recomputes it.
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';

async function rpc(method: string, params: unknown[], deps: { fetchImpl: Fetch }): Promise<any> {
  const response = await deps.fetchImpl(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'noren-mcp/0.1' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = (await response.json()) as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

export async function verifyOnChain(txHash: string, deps: { fetchImpl: Fetch }) {
  const receipt: any = await rpc('eth_getTransactionReceipt', [txHash], deps);
  if (!receipt) return { txHash, found: false, note: 'No receipt on Robinhood Chain for this hash.' };
  const transfers = (receipt.logs as any[])
    .filter((l) => l.address.toLowerCase() === USDG.toLowerCase() && l.topics?.[0] === TRANSFER_TOPIC && l.topics.length === 3)
    .map((l) => ({
      from: '0x' + l.topics[1].slice(26),
      to: '0x' + l.topics[2].slice(26),
      usdg: Number(BigInt(l.data)) / 1e6,
    }));
  return {
    txHash,
    found: true,
    network: CHAIN,
    success: receipt.status === '0x1',
    blockNumber: parseInt(receipt.blockNumber, 16),
    usdgTransfers: transfers,
  };
}

// ---- x402 payment ----------------------------------------------------------
export type PayFn = (args: {
  slug: string;
  base: string;
  env: NodeJS.ProcessEnv;
  fetchImpl: Fetch;
  priceUsdg: number;
}) => Promise<{ result: unknown; txHash?: string; paidUsdg: number }>;

async function payCall(slug: string, base: string, deps: { env: NodeJS.ProcessEnv; fetchImpl: Fetch; ledger: Ledger; pay: PayFn }): Promise<ToolResult> {
  if (!deps.env.NOREN_PAYER_KEY?.trim()) {
    return asError('NOREN_PAYER_KEY is not set in the client environment. The payer key never goes through the model.');
  }
  const list = await getJson(`${base}/x402/apis`, deps);
  const entry = (list.body?.apis ?? []).find((a: any) => a.slug === slug);
  if (!entry) return asError(`Unknown API slug "${slug}". Use noren_list_apis.`);
  const price = Number(entry.price);
  if (!Number.isFinite(price) || price <= 0) return asError('The gateway returned an invalid price for this API.');
  const blocked = checkCaps(price, readCaps(deps.env), deps.ledger);
  if (blocked) return asError(blocked);
  const out = await deps.pay({ slug, base, env: deps.env, fetchImpl: deps.fetchImpl, priceUsdg: price });
  deps.ledger.day = today();
  deps.ledger.spent = (deps.ledger.day === today() ? deps.ledger.spent : 0) + out.paidUsdg;
  return asText({ slug, paidUsdg: out.paidUsdg, network: CHAIN, settlementTx: out.txHash ?? null, result: out.result });
}

const INTENT_TYPES = {
  PaymentIntent: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'resource', type: 'string' },
  ],
};
const ERC20_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];

async function postJson(url: string, body: unknown, fetchImpl: Fetch) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'noren-mcp/0.1' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: response.status, json };
}

/**
 * Pays one 402 challenge: approve the gateway spender for exactly the price,
 * sign an EIP-712 PaymentIntent with the client's own key, settle through the
 * facilitator, then redeem the receipt. The key never leaves this process and
 * is never returned to the model.
 */
export async function realPay(args: Parameters<PayFn>[0]): Promise<Awaited<ReturnType<PayFn>>> {
  const { slug, base, env, fetchImpl, priceUsdg } = args;
  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(env.NOREN_PAYER_KEY!.trim(), provider);
  const resourceUrl = `${base}/x402/api/${slug}`;

  const first = await getJson(resourceUrl, { fetchImpl });
  if (first.status !== 402) throw new Error(`Expected a 402 challenge, got HTTP ${first.status}.`);
  const accept = (first.body?.accepts ?? [])[0];
  if (!accept) throw new Error('The 402 challenge contained no payment option.');
  if (accept.network !== CHAIN) throw new Error(`Unexpected network ${accept.network}; only ${CHAIN} is supported.`);
  if (String(accept.asset).toLowerCase() !== USDG.toLowerCase()) throw new Error('Unexpected payment asset; only USDG is supported.');
  const value = BigInt(accept.maxAmountRequired);
  if (Number(value) / 1e6 > priceUsdg + 1e-9) throw new Error('The challenge asks for more than the listed price. Refusing to pay.');
  const spender: string | undefined = accept.extra?.spender;
  if (!spender || !ADDRESS.test(spender)) throw new Error('The challenge did not name a valid spender.');

  const token = new Contract(USDG, ERC20_ABI, wallet);
  const allowance: bigint = await token.allowance(wallet.address, spender);
  if (allowance < value) {
    const tx = await token.approve(spender, value);
    await tx.wait();
  }

  const now = Math.floor(Date.now() / 1000);
  const intent = {
    from: wallet.address,
    to: accept.payTo,
    value: accept.maxAmountRequired,
    validAfter: now - 120,
    validBefore: now + 300,
    nonce: '0x' + Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(32))).toString('hex'),
    resource: accept.resource,
  };
  const domain = { name: accept.extra.name, version: accept.extra.version, chainId: accept.extra.chainId, verifyingContract: USDG };
  const signature = await wallet.signTypedData(domain, INTENT_TYPES, intent);

  const settled = await postJson(`${base}/facilitator/settle`, { intent, signature, chainId: 4663 }, fetchImpl);
  if (!settled.json?.success) {
    throw new Error(`Settlement failed: ${String(settled.json?.errorReason ?? settled.json?.error ?? settled.status)}`);
  }
  const redeemed = await fetchImpl(resourceUrl, {
    headers: { 'X-PAYMENT': String(settled.json.payment ?? ''), 'User-Agent': 'noren-mcp/0.1' },
  });
  const text = await redeemed.text();
  let result: unknown = text;
  try {
    result = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (redeemed.status !== 200) throw new Error(`Redeem failed with HTTP ${redeemed.status} after settlement ${settled.json.transaction}.`);
  return { result, txHash: settled.json.transaction, paidUsdg: Number(value) / 1e6 };
}

// ---- server ----------------------------------------------------------------
export function buildServer(deps: { env?: NodeJS.ProcessEnv; fetchImpl?: Fetch; pay?: PayFn; exposePay?: boolean } = {}) {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const exposePay = deps.exposePay ?? true;
  const ledger: Ledger = { day: today(), spent: 0 };
  const server = new Server({ name: 'noren', version: '0.1.2' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: exposePay ? TOOLS : TOOLS.filter((t) => t.name !== 'noren_pay_call'),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!exposePay && request.params.name === 'noren_pay_call') {
      return asError('noren_pay_call is not available on the hosted endpoint. Run noren-mcp locally over stdio with your own NOREN_PAYER_KEY.');
    }
    return callTool(request.params.name, request.params.arguments ?? {}, { env, fetchImpl, ledger, pay: exposePay ? (deps.pay ?? realPay) : undefined });
  });
  return server;
}

async function main() {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
}

function isEntrypoint(): boolean {
  // npm runs bins through a symlink in node_modules/.bin, so compare real paths.
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  main().catch((error) => {
    console.error(redact(String(error?.message ?? error), process.env));
    process.exit(1);
  });
}
