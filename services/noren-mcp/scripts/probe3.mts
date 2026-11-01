import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const t = new StdioClientTransport({ command: 'node', args: ['dist/server.js'], env: { ...process.env } as Record<string, string> });
const c = new Client({ name: 'probe', version: '0' });
await c.connect(t);
const info = c.getServerVersion();
console.log('server', info?.name, info?.version);
console.log('instructions:', (c.getInstructions() ?? '').replace(/\s+/g, ' ').slice(0, 220));

const tools = (await c.listTools()).tools;
console.log('\n' + tools.length + ' tools');
for (const x of tools) console.log(' -', x.name.padEnd(24), '|', (x.title ?? '').padEnd(28), '| readOnly', x.annotations?.readOnlyHint, '| destructive', x.annotations?.destructiveHint);

const res = await c.listResources();
console.log('\nresources:', res.resources.map((r) => r.uri).join(', '));
const tpl = await c.listResourceTemplates();
console.log('templates:', tpl.resourceTemplates.map((r) => r.uriTemplate).join(', '));
const stats = await c.readResource({ uri: 'noren://stats' });
console.log('noren://stats ->', String(stats.contents[0].text).replace(/\s+/g, ' ').slice(0, 160));

const prompts = await c.listPrompts();
console.log('\nprompts:', prompts.prompts.map((p) => p.name).join(', '));
const bp: any = await c.getPrompt({ name: 'buy_api', arguments: { slug: 'news', payer: '0xEAaBd1997d4Bd739620323F1fAb25D700043a6D5' } });
console.log('buy_api ->', String(bp.messages[0].content.text).replace(/\s+/g, ' ').slice(0, 300));

for (const address of ['0xA59b92F48E2525C364F7F54663b69da68Cd26529', '0x0000000000000000000000000000000000000001']) {
  const r: any = await c.callTool({ name: 'noren_check_counterparty', arguments: { address } });
  const o = JSON.parse(r.content[0].text);
  console.log('\ncheck', address.slice(0, 10) + '…', '->', JSON.stringify({ verdict: o.verdict, score: o.score, tier: o.tier, settled: o.settledCount, totalUsdg: o.totalUsdg, txCount: o.txCount, eth: o.ethBalance }));
  console.log('  reasons:', o.reasons.join(' | '));
  console.log('  caveat :', o.caveat);
}
const bad: any = await c.callTool({ name: 'noren_check_counterparty', arguments: { address: 'nope' } });
console.log('\nbad address -> isError', bad.isError, '|', String(bad.content[0].text).slice(0, 100));
await c.close();
