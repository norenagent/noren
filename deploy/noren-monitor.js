#!/usr/bin/env node
// noren monitor: runs every minute (systemd timer). Checks what loses users or money when it breaks.
// It alerts on a state CHANGE (ok -> bad, bad -> ok) and repeats every 6 h while something stays bad, so it never spams.
// State: /var/lib/noren-monitor/state.json. Alerts: /var/lib/noren-monitor/alerts.log and, when configured, Telegram.
// Reads only public endpoints, local service state and the error file the console writes. It spends nothing.
'use strict';
const fs = require('fs'), cp = require('child_process');

const DIR = '/var/lib/noren-monitor';
const STATE = DIR + '/state.json', LOG = DIR + '/alerts.log';
const ERR_FILE = DIR + '/sandbox-web-errors.jsonl';
const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const SETTLEMENT = '0xA59b92F48E2525C364F7F54663b69da68Cd26529';
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const UA = { 'user-agent': 'Mozilla/5.0 noren-monitor' };

const readEnv = f => { try { return Object.fromEntries(fs.readFileSync(f, 'utf8').trim().split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })); } catch { return {}; } };
const ALERT = readEnv('/etc/noren-monitor/alerts.env');
const sh = c => { try { return cp.execSync(c, { encoding: 'utf8', timeout: 20000 }).trim(); } catch (e) { return String(e.stdout || '').trim(); } };
const withTimeout = (p, ms = 15000) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
const get = (u, o = {}) => withTimeout(fetch(u, { headers: UA, redirect: 'manual', ...o }));
const rpc = async (method, params) => { const r = await withTimeout(fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json', ...UA }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })); return (await r.json()).result; };

(async () => {
  const checks = {};
  const set = (name, ok, level, msg) => { checks[name] = { ok, level: ok ? 'ok' : level, msg }; };

  // 1. services
  for (const u of ['oc-landing', 'oc-sandbox-web', 'oc-sandbox-daemon', 'noren-proxy', 'noren-mcp']) {
    set('svc:' + u, sh(`systemctl is-active ${u}`) === 'active', 'crit', `${u} is not active`);
  }

  // 2. public reachability, from the outside (DNS + tunnel + app)
  const pages = [['web', 'https://usenoren.xyz/'], ['docs', 'https://docs.usenoren.xyz/'], ['sandbox', 'https://sandbox.usenoren.xyz/'], ['gateway', 'https://gateway.usenoren.xyz/health'], ['mcp', 'https://mcp.usenoren.xyz/health']];
  for (const [n, u] of pages) {
    try { const r = await get(u, { redirect: 'follow' }); set('public:' + n, r.status === 200, 'crit', `${u} -> ${r.status}`); }
    catch (e) { set('public:' + n, false, 'crit', `${u} unreachable (${e.message})`); }
  }

  // 3. the audit chain the sandbox shows must stay valid
  try {
    const r = await get('https://sandbox.usenoren.xyz/api/noren/audit/verify', { redirect: 'follow' });
    const j = await r.json();
    set('sandbox:audit-chain', j?.report?.valid === true, 'crit', `audit chain reports valid=${j?.report?.valid} failures=${(j?.report?.failures || []).length}`);
  } catch (e) { set('sandbox:audit-chain', false, 'warn', 'could not read the audit verify endpoint: ' + e.message); }

  // 4. gateway can still settle: gas in the settlement wallet, and the facilitator advertises the chain
  try {
    const eth = BigInt(await rpc('eth_getBalance', [SETTLEMENT, 'latest']));
    set('gateway:settlement-gas', eth >= 100000000000000n, 'crit', `settlement wallet has ${Number(eth) / 1e18} ETH, below 0.0001. Payments will stop settling`);
  } catch (e) { set('gateway:settlement-gas', false, 'warn', 'could not read the settlement wallet: ' + e.message); }
  try {
    const r = await get('https://gateway.usenoren.xyz/supported', { redirect: 'follow' });
    const j = await r.json();
    set('gateway:facilitator', Array.isArray(j.kinds) && j.kinds.length > 0, 'crit', 'the facilitator advertises no payment kinds (it was empty before the gas ran out once)');
  } catch (e) { set('gateway:facilitator', false, 'warn', 'could not read /supported: ' + e.message); }

  // 5. hosted MCP answers a protocol call, not just /health
  try {
    const r = await get('https://mcp.usenoren.xyz/', { redirect: 'follow' });
    const j = await r.json();
    set('mcp:tools', Array.isArray(j.tools) && j.tools.length >= 8, 'crit', `hosted MCP lists ${(j.tools || []).length} tools, expected at least 8`);
  } catch (e) { set('mcp:tools', false, 'warn', 'hosted MCP root did not answer: ' + e.message); }

  // 6. disk, because the audit log and builds grow
  const used = parseInt(sh("df --output=pcent / | tail -1").replace(/[^0-9]/g, ''), 10) || 0;
  set('host:disk', used < 92, 'warn', `root disk is ${used}% full`);

  // 7. errors the console recorded: more than 5 distinct failures in the last 10 minutes
  try {
    const cutoff = Date.now() - 10 * 60 * 1000;
    const rows = fs.existsSync(ERR_FILE) ? fs.readFileSync(ERR_FILE, 'utf8').trim().split('\n').slice(-500).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(r => r && r.t >= cutoff) : [];
    const groups = {}; for (const r of rows) groups[`${r.route} ${r.name}`] = (groups[`${r.route} ${r.name}`] || 0) + 1;
    const worst = Object.entries(groups).sort((a, b) => b[1] - a[1])[0];
    set('sandbox:errors', rows.length <= 5, 'warn', `${rows.length} server errors in 10 min, most from ${worst ? worst[0] + ' (' + worst[1] + 'x)' : 'n/a'}`);
    if (fs.existsSync(ERR_FILE) && fs.statSync(ERR_FILE).size > 5 * 1024 * 1024) fs.writeFileSync(ERR_FILE, fs.readFileSync(ERR_FILE, 'utf8').split('\n').slice(-1000).join('\n') + '\n');
  } catch { /* ignore */ }

  // ---- compare with the last state, alert on change
  fs.mkdirSync(DIR, { recursive: true });
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { /* first run */ }
  const now = Date.now(), SIX_H = 6 * 3600 * 1000;
  const next = {}, lines = [];
  for (const [name, c] of Object.entries(checks)) {
    const p = prev[name] || { ok: true, since: now, lastAlert: 0 };
    const entry = { ok: c.ok, level: c.level, msg: c.msg, since: p.ok === c.ok ? p.since : now, lastAlert: p.lastAlert || 0 };
    if (!c.ok && (p.ok || now - entry.lastAlert > SIX_H)) { lines.push(`${c.level === 'crit' ? '🔴' : '🟠'} ${name}: ${c.msg}`); entry.lastAlert = now; }
    if (c.ok && !p.ok) { lines.push(`🟢 ${name}: recovered after ${Math.round((now - p.since) / 60000)} min`); entry.lastAlert = 0; }
    next[name] = entry;
  }
  fs.writeFileSync(STATE, JSON.stringify(next, null, 1));
  fs.writeFileSync(DIR + '/summary.json', JSON.stringify({ at: new Date().toISOString(), ok: Object.values(next).every(c => c.ok), failing: Object.entries(next).filter(([, c]) => !c.ok).map(([n]) => n), checks: Object.keys(next).length }));
  if (lines.length) {
    const text = 'noren monitor\n' + lines.join('\n');
    fs.appendFileSync(LOG, new Date().toISOString() + '\n' + text + '\n\n');
    if (ALERT.TELEGRAM_BOT_TOKEN && ALERT.TELEGRAM_CHAT_ID) {
      try { await withTimeout(fetch(`https://api.telegram.org/bot${ALERT.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: ALERT.TELEGRAM_CHAT_ID, text }) })); }
      catch (e) { fs.appendFileSync(LOG, 'telegram send failed: ' + e.message + '\n'); }
    }
  }
  if (process.argv.includes('--print')) console.log(JSON.stringify({ checks: Object.fromEntries(Object.entries(next).map(([n, c]) => [n, c.ok ? 'ok' : c.msg])) }, null, 1));
})().catch(e => { try { fs.appendFileSync(LOG, new Date().toISOString() + ' monitor crashed: ' + e.message + '\n'); } catch { /* ignore */ } process.exit(0); });
