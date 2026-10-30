import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Protocol probe over stdio. Read tools need nothing. With the `pay` argument it
// spends real USDG, so it requires NOREN_PAYER_KEY in the environment and sets
// tight caps for the run.
const live = process.argv[2] === 'pay';
const env = { ...process.env } as Record<string, string>;
if (live) {
  if (!env.NOREN_PAYER_KEY) {
    console.error('pay mode needs NOREN_PAYER_KEY in the environment');
    process.exit(2);
  }
  env.NOREN_MAX_USDG_PER_CALL = '0.02';
  env.NOREN_MAX_USDG_PER_DAY = '0.03';
}
const transport = new StdioClientTransport({ command: 'node', args: ['dist/server.js'], env });
const client = new Client({ name: 'probe', version: '0.0.1' });
await client.connect(transport);
const tools = await client.listTools();
console.log('tools/list:', tools.tools.map((t) => t.name).join(', '));
const show = (label: string, r: any) => {
  const t = r.content?.[0]?.text ?? '';
  console.log(`${label}${r.isError ? ' [isError]' : ''}:`, t.replace(/\s+/g, ' ').slice(0, 260));
};
show('stats', await client.callTool({ name: 'noren_gateway_stats', arguments: {} }));
show('apis', await client.callTool({ name: 'noren_list_apis', arguments: {} }));
show('reputation', await client.callTool({ name: 'noren_reputation', arguments: { address: '0xEAaBd1997d4Bd739620323F1fAb25D700043a6D5' } }));
show('verify real tx', await client.callTool({ name: 'noren_verify_payment', arguments: { tx_hash: '0x1e59c8be4814425b50fc7f23688f0dc8ad7695a8d24485546872970c46ec09dd' } }));
show('bad address', await client.callTool({ name: 'noren_reputation', arguments: { address: 'nope' } }));
if (live) {
  const r: any = await client.callTool({ name: 'noren_pay_call', arguments: { slug: 'news' } });
  const text = r.content?.[0]?.text ?? '';
  if (r.isError) {
    console.log('PAY [isError]:', text.slice(0, 300));
  } else {
    const j = JSON.parse(text);
    console.log('PAY ok: paidUsdg', j.paidUsdg, '| tx', j.settlementTx, '| result kind', j.result?.payload?.kind, '| items', (j.result?.payload?.items ?? []).length);
    console.log('key in output?', text.includes(env.NOREN_PAYER_KEY.replace(/^0x/, '')));
  }
  const again: any = await client.callTool({ name: 'noren_pay_call', arguments: { slug: 'news' } });
  console.log('2nd call (daily cap 0.03):', again.isError ? 'blocked: ' + again.content[0].text.slice(0, 90) : 'paid again');
  const third: any = await client.callTool({ name: 'noren_pay_call', arguments: { slug: 'signals' } });
  console.log('signals 0.05 > per-call cap:', third.isError ? 'blocked: ' + third.content[0].text.slice(0, 90) : 'PAID (bad)');
}
await client.close();
