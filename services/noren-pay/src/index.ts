import { Wallet, JsonRpcProvider, Contract } from 'ethers';

export const DEFAULT_GATEWAY = 'https://gateway.usenoren.xyz';
export const CHAIN = 'eip155:4663';
export const CHAIN_ID = 4663;
export const DEFAULT_RPC = 'https://rpc.mainnet.chain.robinhood.com';
export const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SLUG = /^[a-z0-9-]{1,64}$/;

type Fetch = typeof fetch;

export class NorenPayError extends Error {
  constructor(
    public code:
      | 'bad_key'
      | 'bad_slug'
      | 'unknown_api'
      | 'cap_per_call'
      | 'cap_per_day'
      | 'not_402'
      | 'wrong_network'
      | 'wrong_asset'
      | 'overcharge'
      | 'bad_spender'
      | 'settle_failed'
      | 'redeem_failed',
    message: string,
  ) {
    super(message);
    this.name = 'NorenPayError';
  }
}

export interface NorenPayOptions {
  /** Payer private key. Stays inside this process. */
  privateKey: string;
  gateway?: string;
  rpcUrl?: string;
  /** Refuse any single call above this many USDG. Default 0.10. */
  maxPerCallUsdg?: number;
  /** Refuse once today's spend (UTC) would pass this. Default 1.00. */
  maxPerDayUsdg?: number;
  fetch?: Fetch;
}

export interface PaidResult<T = unknown> {
  slug: string;
  paidUsdg: number;
  settlementTx: string | null;
  data: T;
}

export interface ApiListing {
  slug: string;
  path: string;
  price: string;
  description: string;
  payTo: string;
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

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export function createNorenPay(opts: NorenPayOptions) {
  const key = opts.privateKey?.trim();
  if (!key || !/^(0x)?[0-9a-fA-F]{64}$/.test(key)) {
    throw new NorenPayError('bad_key', 'privateKey must be a 32-byte hex key.');
  }
  const gateway = (opts.gateway ?? DEFAULT_GATEWAY).replace(/\/+$/, '');
  const fetchImpl = opts.fetch ?? fetch;
  const perCall = opts.maxPerCallUsdg ?? 0.1;
  const perDay = opts.maxPerDayUsdg ?? 1;
  const provider = new JsonRpcProvider(opts.rpcUrl ?? DEFAULT_RPC);
  const wallet = new Wallet(key.startsWith('0x') ? key : '0x' + key, provider);
  const ledger = { day: utcDay(), spent: 0 };

  function spentToday(now = new Date()) {
    if (ledger.day !== utcDay(now)) {
      ledger.day = utcDay(now);
      ledger.spent = 0;
    }
    return ledger.spent;
  }

  async function listApis(): Promise<ApiListing[]> {
    const res = await fetchImpl(`${gateway}/x402/apis`, { headers: { 'User-Agent': 'noren-pay/0.1' } });
    if (!res.ok) throw new NorenPayError('unknown_api', `Gateway returned HTTP ${res.status} for the API catalog.`);
    const body = await readJson(res);
    return Array.isArray(body?.apis) ? body.apis : [];
  }

  /** Pay for one call and return the data. Checks every field of the challenge before any money moves. */
  async function fetchPaid<T = unknown>(slug: string): Promise<PaidResult<T>> {
    if (!SLUG.test(slug)) throw new NorenPayError('bad_slug', 'slug must be lowercase letters, digits and dashes.');
    const resource = `${gateway}/x402/api/${slug}`;

    const first = await fetchImpl(resource, { headers: { 'User-Agent': 'noren-pay/0.1' } });
    if (first.status !== 402) {
      throw new NorenPayError('not_402', `Expected a 402 challenge, got HTTP ${first.status}.`);
    }
    const challenge = await readJson(first);
    const accept = (challenge?.accepts ?? [])[0];
    if (!accept) throw new NorenPayError('not_402', 'The 402 challenge contained no payment option.');
    if (accept.network !== CHAIN) throw new NorenPayError('wrong_network', `Challenge network ${accept.network}; only ${CHAIN} is supported.`);
    if (String(accept.asset).toLowerCase() !== USDG.toLowerCase()) throw new NorenPayError('wrong_asset', 'Challenge asset is not USDG.');
    if (!ADDRESS.test(String(accept.payTo))) throw new NorenPayError('bad_spender', 'Challenge has no valid payTo address.');
    const spender: string | undefined = accept.extra?.spender;
    if (!spender || !ADDRESS.test(spender)) throw new NorenPayError('bad_spender', 'Challenge did not name a valid spender.');

    const value = BigInt(accept.maxAmountRequired);
    const price = Number(value) / 1e6;
    if (!(price > 0)) throw new NorenPayError('overcharge', 'Challenge price is not positive.');

    // The catalog price is the contract with the buyer: the 402 may never ask for more.
    const listed = (await listApis()).find((a) => a.slug === slug);
    if (!listed) throw new NorenPayError('unknown_api', `"${slug}" is not in the gateway catalog.`);
    if (price > Number(listed.price) + 1e-9) {
      throw new NorenPayError('overcharge', `Challenge asks ${price} USDG but the catalog lists ${listed.price}. Refusing to pay.`);
    }
    if (price > perCall + 1e-9) throw new NorenPayError('cap_per_call', `Price ${price} USDG exceeds your per-call cap ${perCall} USDG.`);
    const spent = spentToday();
    if (spent + price > perDay + 1e-9) {
      throw new NorenPayError('cap_per_day', `Daily cap ${perDay} USDG would be exceeded (spent today ${spent}).`);
    }

    const token = new Contract(USDG, ERC20_ABI, wallet);
    const allowance: bigint = await token.allowance(wallet.address, spender);
    if (allowance < value) {
      const tx = await token.approve(spender, value); // exactly the price, never unlimited
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
    const domain = { name: accept.extra.name, version: accept.extra.version, chainId: accept.extra.chainId ?? CHAIN_ID, verifyingContract: USDG };
    const signature = await wallet.signTypedData(domain, INTENT_TYPES, intent);

    const settleRes = await fetchImpl(`${gateway}/facilitator/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'noren-pay/0.1' },
      body: JSON.stringify({ intent, signature, chainId: CHAIN_ID }),
    });
    const settled = await readJson(settleRes);
    if (!settled?.success) {
      throw new NorenPayError('settle_failed', `Settlement failed: ${String(settled?.errorReason ?? settled?.error ?? settleRes.status)}`);
    }

    // Money has moved: record it before the redeem so a redeem error cannot hide the spend.
    ledger.spent = spentToday() + price;

    const redeemed = await fetchImpl(resource, { headers: { 'X-PAYMENT': String(settled.payment ?? ''), 'User-Agent': 'noren-pay/0.1' } });
    if (redeemed.status !== 200) {
      throw new NorenPayError('redeem_failed', `Redeem failed with HTTP ${redeemed.status} after settlement ${settled.transaction}.`);
    }
    return { slug, paidUsdg: price, settlementTx: settled.transaction ?? null, data: (await readJson(redeemed)) as T };
  }

  return {
    address: wallet.address,
    listApis,
    fetchPaid,
    spentTodayUsdg: () => spentToday(),
  };
}
