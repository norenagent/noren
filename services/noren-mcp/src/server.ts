#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Wallet, JsonRpcProvider, Contract, Interface, getAddress, formatEther } from 'ethers';

type TextContent = { type: 'text'; text: string };
export type ToolResult = { content: TextContent[]; isError?: boolean };
type Fetch = typeof fetch;
type ToolInputSchema = Tool['inputSchema'];

export const VERSION = '0.3.0';
export const DEFAULT_GATEWAY = 'https://gateway.usenoren.xyz';
export const CHAIN = 'eip155:4663';
export const RPC_URL = 'https://rpc.mainnet.chain.robinhood.com';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

const reputationSchema = z.object({ address: z.string().regex(ADDRESS) });
const txSchema = z.object({ tx_hash: z.string().regex(TX_HASH) });
const listSchema = z.object({});
const leaderboardSchema = z.object({ limit: z.number().int().positive().max(50).optional() });
const requestSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  payer: z.string().regex(ADDRESS),
});
const submitSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  intent: z.object({
    from: z.string().regex(ADDRESS),
    to: z.string().regex(ADDRESS),
    value: z.string().regex(/^[0-9]{1,30}$/),
    validAfter: z.union([z.number().int(), z.string().regex(/^[0-9]{1,12}$/)]),
    validBefore: z.union([z.number().int(), z.string().regex(/^[0-9]{1,12}$/)]),
    nonce: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    resource: z.string().max(300),
  }),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});
const counterpartySchema = z.object({ address: z.string().regex(ADDRESS) });
const payCallSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
});

type Annotations = NonNullable<Tool['annotations']>;
const READ: Annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const PAY: Annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

function describeTool(name: string, title: string, annotations: Annotations, description: string, inputSchema: ToolInputSchema): Tool {
  return { name, title, description, inputSchema, annotations: { title, ...annotations } };
}

const addressProp = { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$', description: 'EVM address (0x...)' };

export const TOOLS: Tool[] = [
  describeTool(
    'noren_gateway_stats',
    'Gateway statistics',
    READ,
    'Live gateway statistics: how many paid APIs, 402 challenges, and settled USDG payments on Robinhood Chain (eip155:4663), read from the gateway.',
    { type: 'object', properties: {}, additionalProperties: false },
  ),
  describeTool(
    'noren_list_apis',
    'List paid APIs',
    READ,
    'List the pay-per-call APIs the gateway sells, with their path and price in USDG. Use a slug from this list with noren_payment_request (hosted, you sign) or noren_pay_call (local, with your own key).',
    { type: 'object', properties: {}, additionalProperties: false },
  ),
  describeTool(
    'noren_reputation',
    'Wallet reputation',
    READ,
    'Reputation of an EVM wallet computed only from payments that settled on Robinhood Chain: score, tier, settled count, total USDG and the transaction hashes behind it.',
    { type: 'object', properties: { address: addressProp }, required: ['address'], additionalProperties: false },
  ),
  describeTool(
    'noren_leaderboard',
    'Payer leaderboard',
    READ,
    'Top paying wallets by settled count, from the gateway leaderboard.',
    { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } }, additionalProperties: false },
  ),
  describeTool(
    'noren_verify_payment',
    'Verify payment on-chain',
    READ,
    'Check a payment on Robinhood Chain directly from the chain RPC: whether the transaction succeeded and the USDG Transfer events it contains. Does not trust the gateway.',
    {
      type: 'object',
      properties: { tx_hash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$', description: 'Transaction hash' } },
      required: ['tx_hash'],
      additionalProperties: false,
    },
  ),
  describeTool(
    'noren_check_counterparty',
    'Check a counterparty before paying',
    READ,
    'Guard: check a wallet before you pay it or buy from it. Combines the gateway reputation (payments settled through Noren) with the wallet\'s native ETH balance and transaction count read from the Robinhood Chain RPC. Returns a verdict: known_good = at least 5 settled payments AND score >= 40; limited_history = 1 to 4 settled payments; unknown = no settled payments recorded. Read only. The verdict reflects only payments settled through the Noren gateway and is not a guarantee. Related: noren_reputation.',
    { type: 'object', properties: { address: addressProp }, required: ['address'], additionalProperties: false },
  ),
  describeTool(
    'noren_payment_request',
    'Build payment request (spends nothing)',
    READ,
    'Step 1 of paying for an API from a hosted agent without sharing a key. Give an API slug and YOUR wallet address; returns the exact price, whether your wallet must first approve USDG (with the ready-to-send approve transaction) and the EIP-712 typed data for your wallet to sign. Nothing is spent and the server never sees a key. Then sign the typed data locally and call noren_submit_payment.',
    {
      type: 'object',
      properties: { slug: { type: 'string', pattern: '^[a-z0-9-]+$', description: 'API slug from noren_list_apis' }, payer: addressProp },
      required: ['slug', 'payer'],
      additionalProperties: false,
    },
  ),
  describeTool(
    'noren_submit_payment',
    'Submit signed payment',
    PAY,
    'Step 2: send the signed payment. Pass the slug, the intent object returned by noren_payment_request (unchanged) and the signature your wallet produced. The gateway settles USDG on Robinhood Chain and returns the API result and the settlement transaction. Fails with a clear reason if the intent was altered, expired, unfunded or not approved.',
    {
      type: 'object',
      properties: {
        slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
        intent: { type: 'object', description: 'The intent from noren_payment_request, unchanged' },
        signature: { type: 'string', pattern: '^0x[0-9a-fA-F]{130}$', description: 'EIP-712 signature of the typed data' },
      },
      required: ['slug', 'intent', 'signature'],
      additionalProperties: false,
    },
  ),
  describeTool(
    'noren_pay_call',
    'Pay for an API call (local key)',
    PAY,
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
      case 'noren_check_counterparty': {
        const { address } = counterpartySchema.parse(rawArgs);
        return asText(await checkCounterparty(address, base, deps));
      }
      case 'noren_verify_payment': {
        const { tx_hash } = txSchema.parse(rawArgs);
        return asText(await verifyOnChain(tx_hash, deps));
      }
      case 'noren_payment_request': {
        const args = requestSchema.parse(rawArgs);
        return await paymentRequest(args.slug, args.payer, base, deps);
      }
      case 'noren_submit_payment': {
        const args = submitSchema.parse(rawArgs);
        return await submitPayment(args, base, deps);
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

// ---- Guard: counterparty check ----------------------------------------------
export type Verdict = 'known_good' | 'limited_history' | 'unknown';
export const GUARD_CAVEAT =
  'This reflects only payments settled through the Noren gateway and on-chain basics. It is not a guarantee about the wallet or its owner.';

export function verdictFor(settledCount: number, score: number): Verdict {
  if (settledCount >= 5 && score >= 40) return 'known_good';
  if (settledCount >= 1) return 'limited_history';
  return 'unknown';
}

function toIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  const d = Number.isFinite(n) ? new Date(n) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function checkCounterparty(address: string, base: string, deps: { fetchImpl: Fetch }) {
  const reasons: string[] = [];
  let caveat = GUARD_CAVEAT;
  let rep: any = null;
  let reputationOk = true;
  try {
    const r = await getJson(`${base}/reputation/${address}`, deps);
    if (r.status === 200) rep = r.body;
    else if (r.status !== 404) {
      reputationOk = false;
      reasons.push(`Gateway reputation lookup failed with HTTP ${r.status}.`);
    }
  } catch (e) {
    reputationOk = false;
    reasons.push(`Gateway reputation lookup failed: ${(e as Error).message}`);
  }

  let txCount: number | null = null;
  let ethBalance: string | null = null;
  try {
    const [bal, nonce] = await Promise.all([
      rpc('eth_getBalance', [address, 'latest'], deps),
      rpc('eth_getTransactionCount', [address, 'latest'], deps),
    ]);
    ethBalance = formatEther(BigInt(bal));
    txCount = Number(BigInt(nonce));
  } catch (e) {
    reasons.push(`Chain RPC lookup failed (${(e as Error).message}); ETH balance and transaction count are unavailable.`);
    caveat += ' The chain RPC was unreachable, so on-chain facts are missing.';
  }
  if (!reputationOk) caveat += ' The gateway reputation could not be read, so the verdict is not based on settlement history.';

  const settledCount = Number(rep?.settledCount ?? 0) || 0;
  const score = Number(rep?.score ?? 0) || 0;
  const verdict = reputationOk ? verdictFor(settledCount, score) : 'unknown';
  const totalUsdg = Number(rep?.totalUsdg ?? 0) || 0;
  const tier = String(rep?.tier ?? 'unknown');

  if (reputationOk) {
    if (settledCount === 0) reasons.push('No payments settled through the Noren gateway for this wallet.');
    else reasons.push(`${settledCount} settled payment${settledCount === 1 ? '' : 's'} totalling ${totalUsdg} USDG, score ${score}, tier ${tier}.`);
    if (verdict === 'limited_history' && settledCount >= 1) reasons.push('Fewer than 5 settled payments, or score below 40, so it is not rated known_good.');
  }
  if (txCount !== null) {
    reasons.push(txCount === 0 ? 'Wallet has sent no transactions on Robinhood Chain.' : `Wallet has sent ${txCount} transaction${txCount === 1 ? '' : 's'} on Robinhood Chain.`);
  }
  if (ethBalance !== null) reasons.push(`Native ETH balance: ${ethBalance}.`);

  return {
    address,
    verdict,
    score,
    tier,
    settledCount,
    totalUsdg,
    firstSeen: toIso(rep?.firstSeen),
    lastSeen: toIso(rep?.lastSeen),
    txCount,
    ethBalance,
    reasons,
    caveat,
  };
}


// ---- non-custodial payment (works on the hosted endpoint) ------------------
const TYPED_DOMAIN_FIELDS = ['name', 'version', 'chainId', 'verifyingContract'] as const;
const APPROVE_IFACE = new Interface(['function approve(address spender, uint256 value)']);
const ALLOWANCE_IFACE = new Interface(['function allowance(address owner, address spender) view returns (uint256)']);

async function challengeFor(slug: string, base: string, deps: { fetchImpl: Fetch }) {
  const list = await getJson(`${base}/x402/apis`, deps);
  const entry = (list.body?.apis ?? []).find((a: any) => a.slug === slug);
  if (!entry) throw new Error(`Unknown API slug "${slug}". Use noren_list_apis.`);
  const price = Number(entry.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error('The gateway returned an invalid price for this API.');
  const resourceUrl = `${base}/x402/api/${slug}`;
  const first = await getJson(resourceUrl, deps);
  if (first.status !== 402) throw new Error(`Expected a 402 challenge, got HTTP ${first.status}.`);
  const accept = (first.body?.accepts ?? [])[0];
  if (!accept) throw new Error('The 402 challenge contained no payment option.');
  if (accept.network !== CHAIN) throw new Error(`Unexpected network ${accept.network}; only ${CHAIN} is supported.`);
  if (String(accept.asset).toLowerCase() !== USDG.toLowerCase()) throw new Error('Unexpected payment asset; only USDG is supported.');
  if (!ADDRESS.test(String(accept.payTo))) throw new Error('The challenge did not name a valid payee.');
  const spender: string | undefined = accept.extra?.spender;
  if (!spender || !ADDRESS.test(spender)) throw new Error('The challenge did not name a valid spender.');
  const value = BigInt(accept.maxAmountRequired);
  if (Number(value) / 1e6 > price + 1e-9) throw new Error('The challenge asks for more than the listed price. Refusing.');
  return { accept, price, value, spender, resourceUrl };
}

export async function paymentRequest(slug: string, payer: string, base: string, deps: { fetchImpl: Fetch }): Promise<ToolResult> {
  const c = await challengeFor(slug, base, deps);
  const owner = getAddress(payer);
  let allowance = 0n;
  try {
    const out = await rpc('eth_call', [{ to: USDG, data: ALLOWANCE_IFACE.encodeFunctionData('allowance', [owner, c.spender]) }, 'latest'], deps);
    allowance = BigInt(out);
  } catch {
    /* unknown allowance: assume approval is needed */
  }
  const needsApprove = allowance < c.value;
  const now = Math.floor(Date.now() / 1000);
  const intent = {
    from: owner,
    to: getAddress(c.accept.payTo),
    value: c.accept.maxAmountRequired,
    validAfter: now - 120,
    validBefore: now + 300,
    nonce: '0x' + Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(32))).toString('hex'),
    resource: c.accept.resource,
  };
  const domain = { name: c.accept.extra.name, version: c.accept.extra.version, chainId: c.accept.extra.chainId, verifyingContract: USDG };
  void TYPED_DOMAIN_FIELDS;
  return asText({
    slug,
    network: CHAIN,
    priceUsdg: c.price,
    payer: owner,
    needsApprove,
    approve: needsApprove
      ? {
          note: 'Send this transaction from your wallet first (it allows the gateway to move exactly this price in USDG, nothing more). It needs a little ETH for gas on Robinhood Chain.',
          chainId: 4663,
          to: USDG,
          value: '0x0',
          data: APPROVE_IFACE.encodeFunctionData('approve', [c.spender, c.value]),
        }
      : null,
    intent,
    typedData: {
      domain,
      types: INTENT_TYPES,
      primaryType: 'PaymentIntent',
      message: intent,
    },
    validForSeconds: 300,
    next: needsApprove
      ? 'Send the approve transaction, wait for it to confirm, sign typedData with your wallet (eth_signTypedData_v4), then call noren_submit_payment with slug, intent and signature.'
      : 'Sign typedData with your wallet (eth_signTypedData_v4), then call noren_submit_payment with slug, intent and signature.',
  });
}

export async function submitPayment(
  args: z.infer<typeof submitSchema>,
  base: string,
  deps: { fetchImpl: Fetch },
): Promise<ToolResult> {
  const c = await challengeFor(args.slug, base, deps);
  const { intent } = args;
  // The server does not trust the caller's copy: every field that moves money must match a fresh challenge.
  if (intent.to.toLowerCase() !== String(c.accept.payTo).toLowerCase()) return asError('intent.to does not match the gateway payee. Request a new payment with noren_payment_request.');
  if (intent.value !== String(c.accept.maxAmountRequired)) return asError('intent.value does not match the price. Request a new payment with noren_payment_request.');
  if (intent.resource !== c.accept.resource) return asError('intent.resource does not match this API. Request a new payment with noren_payment_request.');
  const now = Math.floor(Date.now() / 1000);
  if (Number(intent.validBefore) < now) return asError('This payment request has expired (valid for 5 minutes). Request a new one with noren_payment_request.');

  const settled = await postJson(`${base}/facilitator/settle`, { intent, signature: args.signature, chainId: 4663 }, deps.fetchImpl);
  if (!settled.json?.success) {
    return asError(`Settlement failed: ${String(settled.json?.errorReason ?? settled.json?.error ?? settled.status)}`);
  }
  const redeemed = await deps.fetchImpl(c.resourceUrl, {
    headers: { 'X-PAYMENT': String(settled.json.payment ?? ''), 'User-Agent': 'noren-mcp/0.1' },
  });
  const text = await redeemed.text();
  let result: unknown = text;
  try {
    result = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (redeemed.status !== 200) {
    return asError(`Payment settled (tx ${settled.json.transaction}) but the API call returned HTTP ${redeemed.status}.`);
  }
  return asText({ slug: args.slug, paidUsdg: Number(c.value) / 1e6, network: CHAIN, settlementTx: settled.json.transaction ?? null, result });
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


// ---- resources and prompts --------------------------------------------------
export const RESOURCES = [
  { uri: 'noren://apis', name: 'apis', title: 'Noren paid API catalog', description: 'Pay-per-call APIs with slug, path and USDG price, live from the gateway.', mimeType: 'application/json' },
  { uri: 'noren://stats', name: 'stats', title: 'Noren gateway statistics', description: 'Live counts of APIs, 402 challenges and settled payments.', mimeType: 'application/json' },
];
export const RESOURCE_TEMPLATES = [
  { uriTemplate: 'noren://wallet/{address}', name: 'wallet', title: 'Wallet reputation', description: 'Reputation of an EVM wallet from payments settled through the gateway.', mimeType: 'application/json' },
];
const WALLET_URI = /^noren:\/\/wallet\/(0x[0-9a-fA-F]{40})$/;

export async function readResource(uri: string, base: string, deps: { fetchImpl: Fetch }) {
  let path: string;
  if (uri === 'noren://apis') path = '/x402/apis';
  else if (uri === 'noren://stats') path = '/x402/stats';
  else {
    const m = WALLET_URI.exec(uri);
    if (!m) {
      if (uri.startsWith('noren://wallet/')) throw new McpError(ErrorCode.InvalidParams, 'Invalid wallet address in URI. Expected noren://wallet/0x followed by 40 hex characters.');
      throw new McpError(ErrorCode.InvalidParams, `Unknown resource URI: ${uri}. Available: noren://apis, noren://stats, noren://wallet/{address}.`);
    }
    path = `/reputation/${m[1]}`;
  }
  const r = await getJson(`${base}${path}`, deps);
  let body = r.body;
  if (r.status === 404 && m404(uri)) body = { address: WALLET_URI.exec(uri)![1], score: 0, tier: 'unknown', settledCount: 0, note: 'No settled payments recorded for this wallet.' };
  else if (r.status !== 200) throw new McpError(ErrorCode.InternalError, `Gateway returned HTTP ${r.status} for ${path}.`);
  if (uri === 'noren://stats') body = { network: CHAIN, ...body };
  return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(body, null, 2) }] };
}
function m404(uri: string): boolean {
  return WALLET_URI.test(uri);
}

export const PROMPTS = [
  {
    name: 'buy_api',
    title: 'Buy a Noren API safely',
    description: 'Guided, non-custodial flow to buy one paid API: price check, user consent, wallet signature, settlement, verification.',
    arguments: [
      { name: 'slug', description: 'API slug from noren_list_apis', required: true },
      { name: 'payer', description: 'The wallet address that will pay (0x...)', required: true },
    ],
  },
  {
    name: 'check_before_paying',
    title: 'Check a counterparty before paying',
    description: 'Run the Guard check on a wallet and summarize the verdict in three lines.',
    arguments: [{ name: 'address', description: 'Wallet address to check (0x...)', required: true }],
  },
];

export function getPrompt(name: string, args: Record<string, string> | undefined) {
  const a = args ?? {};
  if (name === 'buy_api') {
    const slug = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits and dashes');
    const parsed = z.object({ slug, payer: z.string().regex(ADDRESS, 'payer must be a 0x wallet address') }).safeParse(a);
    if (!parsed.success) throw new McpError(ErrorCode.InvalidParams, `Invalid arguments: ${parsed.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
    const { slug: s, payer } = parsed.data;
    const text = [
      `Help me buy the Noren API "${s}" and pay from my wallet ${payer}. Follow this safe flow exactly:`,
      '1. Call noren_list_apis and find the slug. Tell me its price in USDG and wait for my explicit yes before going further.',
      `2. After my yes, call noren_payment_request with slug "${s}" and payer "${payer}".`,
      '3. If needsApprove is true, ask my wallet to send the returned approve transaction (exact price only) and wait for it to confirm.',
      '4. Ask my wallet to sign the returned typedData with eth_signTypedData_v4.',
      '5. Call noren_submit_payment with the slug, the intent exactly as returned, and the signature.',
      '6. Show me the API result and the settlement transaction, then offer to run noren_verify_payment on that hash.',
      'Never ask me for a private key and never put one in a tool call. Stop if the network is not eip155:4663 or the asset is not USDG.',
    ].join('\n');
    return { description: `Buy ${s} from ${payer}`, messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
  }
  if (name === 'check_before_paying') {
    const parsed = z.object({ address: z.string().regex(ADDRESS, 'address must be a 0x wallet address') }).safeParse(a);
    if (!parsed.success) throw new McpError(ErrorCode.InvalidParams, `Invalid arguments: ${parsed.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
    const text = [
      `Before I pay ${parsed.data.address}, call noren_check_counterparty with that address.`,
      'Then summarize in exactly 3 lines: (1) the verdict and why, (2) the key facts (settled payments, total USDG, transaction count, ETH balance), (3) the caveat, stated plainly.',
      'Do not pay anything yet. Ask me whether to proceed.',
    ].join('\n');
    return { description: `Guard check for ${parsed.data.address}`, messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
  }
  throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}. Available: buy_api, check_before_paying.`);
}

export const INSTRUCTIONS = [
  'Noren sells pay-per-call APIs in USDG on Robinhood Chain (eip155:4663) over x402.',
  'Read tools: noren_list_apis, noren_gateway_stats, noren_reputation, noren_leaderboard, noren_verify_payment (checks the chain directly).',
  'Guard: call noren_check_counterparty before paying an unfamiliar wallet or API seller and tell the user the verdict and its caveat.',
  'To pay: noren_payment_request (spends nothing) -> wallet signs typedData -> noren_submit_payment. Tell the user the price and get a yes first. Never ask for or send a private key.',
  'noren_pay_call exists only on a local stdio server with caps set by the user.',
  'Resources: noren://apis, noren://stats, noren://wallet/{address}. Prompts: buy_api, check_before_paying.',
].join('\n');

// ---- server ----------------------------------------------------------------
export function buildServer(deps: { env?: NodeJS.ProcessEnv; fetchImpl?: Fetch; pay?: PayFn; exposePay?: boolean } = {}) {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const exposePay = deps.exposePay ?? true;
  const ledger: Ledger = { day: today(), spent: 0 };
  const server = new Server(
    { name: 'noren', version: VERSION },
    { capabilities: { tools: {}, resources: {}, prompts: {} }, instructions: INSTRUCTIONS },
  );
  const base = gatewayUrl(env);
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: RESOURCES }));
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: RESOURCE_TEMPLATES }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => readResource(request.params.uri, base, { fetchImpl }));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }));
  server.setRequestHandler(GetPromptRequestSchema, async (request) => getPrompt(request.params.name, request.params.arguments));
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: exposePay
      ? TOOLS
      : TOOLS.filter((t) => t.name !== 'noren_pay_call').map((t) =>
          t.name === 'noren_list_apis'
            ? {
                ...t,
                description:
                  'List the pay-per-call APIs the gateway sells, with their path and price in USDG. To pay from this hosted endpoint use noren_payment_request then noren_submit_payment: your wallet signs, the server never holds a key.',
              }
            : t,
        ),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!exposePay && request.params.name === 'noren_pay_call') {
      return asError('noren_pay_call is not available on the hosted endpoint, because the server never holds a key. Use noren_payment_request then noren_submit_payment (you sign), or run noren-mcp locally over stdio with your own NOREN_PAYER_KEY.');
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
