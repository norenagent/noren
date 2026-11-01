// Repeatable end-to-end payment proof against the HOSTED Noren MCP.
//
//   npx tsx scripts/e2e-pay.mts --dry          # request + local signature check, moves nothing
//   npx tsx scripts/e2e-pay.mts --pay          # real payment: approve (if needed) + sign + submit
//
// Wallet: ~/.noren-wallets/payer-test.json (field private_key). The key is read from the file and never printed.
// Guards: refuses when the USDG balance is below the price, when the price is above MAX_PRICE_USDG, or when the
// payer has too little ETH to send the approve transaction.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Wallet, JsonRpcProvider, Contract, verifyTypedData, formatUnits } from 'ethers';

const MCP_URL = process.env.NOREN_MCP_URL ?? 'https://mcp.usenoren.xyz/mcp';
const RPC_URL = 'https://rpc.mainnet.chain.robinhood.com';
const SLUG = process.env.NOREN_E2E_SLUG ?? 'news';
const MAX_PRICE_USDG = 0.05;
const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const mode = process.argv.includes('--pay') ? 'pay' : 'dry';

const ERC20 = ['function balanceOf(address) view returns (uint256)'];
const log = (k: string, v: unknown) => console.log(k.padEnd(26), v);

const key = JSON.parse(readFileSync(`${homedir()}/.noren-wallets/payer-test.json`, 'utf8')).private_key as string;
const provider = new JsonRpcProvider(RPC_URL, 4663, { staticNetwork: true });
const wallet = new Wallet(key, provider);
const usdg = new Contract(USDG, ERC20, provider);

const client = new Client({ name: 'noren-e2e', version: '1.0.0' });
await client.connect(
  new StreamableHTTPClientTransport(new URL(MCP_URL), { requestInit: { headers: { 'user-agent': 'Mozilla/5.0 noren-e2e' } } }),
);
const call = async (name: string, args: Record<string, unknown>) => {
  const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  const text = r.content?.[0]?.text ?? '';
  if (r.isError) throw new Error(`${name}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
};

try {
  const tools = (await client.listTools()).tools.map((t) => t.name);
  log('mcp', `${MCP_URL} | tools ${tools.length}`);
  if (!tools.includes('noren_payment_request') || !tools.includes('noren_submit_payment')) throw new Error('pay tools missing on the hosted server');

  const bal = Number(formatUnits(await usdg.balanceOf(wallet.address), 6));
  const eth = Number(formatUnits(await provider.getBalance(wallet.address), 18));
  log('payer', wallet.address);
  log('balance', `${bal} USDG | ${eth} ETH`);

  // 1. counterparty check on the seller (read-only), the way an agent should before paying
  const req = await call('noren_payment_request', { slug: SLUG, payer: wallet.address });
  log('price', `${req.priceUsdg} USDG on ${req.network} | needsApprove=${req.needsApprove}`);
  if (Number(req.priceUsdg) > MAX_PRICE_USDG) throw new Error(`price ${req.priceUsdg} above the ${MAX_PRICE_USDG} guard`);

  const check = await call('noren_check_counterparty', { address: req.intent.to });
  log('seller verdict', `${check.verdict} (settled ${check.settledCount}, ${check.totalUsdg} USDG)`);

  // 2. sign locally and prove the signature recovers to the payer (no funds involved)
  const { domain, types, message } = req.typedData;
  const signature = await wallet.signTypedData(domain, types, message);
  const recovered = verifyTypedData(domain, types, message, signature);
  log('signature recovers', recovered.toLowerCase() === wallet.address.toLowerCase() ? 'yes' : 'NO');
  if (recovered.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('signature does not recover to the payer');

  if (mode === 'dry') {
    log('mode', 'dry: nothing was sent');
    process.exit(0);
  }

  // 3. real payment
  if (bal < Number(req.priceUsdg)) throw new Error(`balance ${bal} USDG is below the price ${req.priceUsdg}`);
  let approveTx: string | null = null;
  if (req.needsApprove) {
    if (eth < 0.00002) throw new Error(`only ${eth} ETH for the approve transaction`);
    const tx = await wallet.sendTransaction({ to: req.approve.to, data: req.approve.data, value: 0n });
    const rc = await tx.wait();
    approveTx = tx.hash;
    log('approve tx', `${tx.hash} status=${rc?.status}`);
    if (rc?.status !== 1) throw new Error('approve transaction failed');
  }

  // the intent has a 5 minute window and is bound to its own nonce: ask again after approve so it is fresh
  const fresh = await call('noren_payment_request', { slug: SLUG, payer: wallet.address });
  const sig2 = await wallet.signTypedData(fresh.typedData.domain, fresh.typedData.types, fresh.typedData.message);
  const paid = await call('noren_submit_payment', { slug: SLUG, intent: fresh.intent, signature: sig2 });
  log('submit', JSON.stringify(paid).slice(0, 220));

  const txHash = paid.settlementTx ?? paid.txHash ?? paid.transaction ?? paid.settlement?.txHash;
  log('settlement tx', txHash ?? '(not in response)');
  if (txHash) {
    const rc = await provider.getTransactionReceipt(txHash);
    log('on-chain status', rc ? `status=${rc.status} block=${rc.blockNumber}` : 'receipt not yet visible');
    log('explorer', `https://robinhoodchain.blockscout.com/tx/${txHash}`);
  }
  const after = Number(formatUnits(await usdg.balanceOf(wallet.address), 6));
  log('balance after', `${after} USDG (spent ${(bal - after).toFixed(6)})`);

  const verified = await call('noren_verify_payment', { tx_hash: txHash });
  log('verify_payment', JSON.stringify(verified).slice(0, 200));
} finally {
  await client.close();
}
