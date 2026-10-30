// test/hardening.js : headers, /metrics gate, reflected-input safety.
// Spawns the server on an isolated port with a temp database. Never touches the live service or its data.
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const assert = require('assert')

const PORT = 8973
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'noren-test-'))
const env = {
  ...process.env,
  NOREN_PORT: String(PORT),
  NOREN_RPC_UPSTREAM: process.env.NOREN_RPC_UPSTREAM || 'https://robinhood-rpc.publicnode.com',
  NOREN_SETTLE_KEY: '0x' + '11'.repeat(32), // dummy, never funded
  NOREN_DB_PATH: path.join(tmp, 'gateway.db'),
  NOREN_ROUTES_STORE: path.join(tmp, 'routes.json'),
  NOREN_VAULT_KEY: process.env.NOREN_VAULT_KEY || 'test-vault-key-' + Math.random().toString(36).slice(2) + 'xxxxxxxx',
  NOREN_METRICS_TOKEN: 'metrics-secret-for-tests',
}

function req(method, p, headers = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers }, res => {
      let out = ''
      res.on('data', c => (out += c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: out }))
    })
    r.on('error', reject)
    r.end()
  })
}

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try { const r = await req('GET', '/health'); if (r.status === 200) return } catch {}
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('server did not start')
}

;(async () => {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  child.stdout.on('data', d => (log += d)); child.stderr.on('data', d => (log += d))
  const checks = []
  const ok = (name, fn) => { try { fn(); checks.push(['✓', name]) } catch (e) { checks.push(['✗', name + ' :: ' + e.message.split('\n')[0]]) } }
  try {
    await waitUp()

    // 1. security headers on the common JSON path and on an error path
    for (const p of ['/health', '/x402/premium?chain=zz', '/nope-does-not-exist']) {
      const r = await req('GET', p)
      ok(`headers on ${p}: nosniff`, () => assert.strictEqual(r.headers['x-content-type-options'], 'nosniff'))
      ok(`headers on ${p}: no-referrer`, () => assert.ok(/no-referrer|same-origin|strict-origin/.test(r.headers['referrer-policy'] || '')))
      ok(`headers on ${p}: CSP default-src 'none'`, () => assert.ok((r.headers['content-security-policy'] || '').includes("default-src 'none'")))
      ok(`headers on ${p}: frame-ancestors none / X-Frame-Options`, () => assert.ok(r.headers['x-frame-options'] === 'DENY' || /frame-ancestors 'none'/.test(r.headers['content-security-policy'] || '')))
      ok(`headers on ${p}: no x-powered-by`, () => assert.ok(!r.headers['x-powered-by']))
    }

    // 2. reflected input stays JSON and cannot be sniffed as html
    const refl = await req('GET', '/x402/premium?chain=%3Cscript%3Ealert(1)%3C%2Fscript%3E')
    ok('reflected <script> is served as application/json', () => assert.ok((refl.headers['content-type'] || '').startsWith('application/json')))
    ok('reflected <script> carries nosniff', () => assert.strictEqual(refl.headers['x-content-type-options'], 'nosniff'))

    // 3. /metrics is gated when a token is configured, and still works with it
    const m0 = await req('GET', '/metrics')
    ok('/metrics without token is refused', () => assert.ok([401, 403, 404].includes(m0.status), 'status ' + m0.status))
    ok('/metrics refusal does not leak counters', () => assert.ok(!/noren_/.test(m0.body)))
    const m1 = await req('GET', '/metrics', { authorization: 'Bearer metrics-secret-for-tests' })
    ok('/metrics with the right bearer works', () => assert.strictEqual(m1.status, 200))
    ok('/metrics body is prometheus text', () => assert.ok(/noren_apis_total/.test(m1.body)))
    const m2 = await req('GET', '/metrics', { authorization: 'Bearer wrong' })
    ok('/metrics with a wrong bearer is refused', () => assert.ok([401, 403, 404].includes(m2.status)))

    // 4. /health stays open (uptime probes and the public status page depend on it)
    const h = await req('GET', '/health')
    ok('/health stays public', () => assert.strictEqual(h.status, 200))

    // 5. discovery and the paid routes still answer as before
    const p = await req('GET', '/x402/premium')
    ok('/x402/premium still answers 402', () => assert.strictEqual(p.status, 402))
    ok('/x402/premium still exposes the v2 payment header', () => assert.ok(p.headers['payment-required'] || p.headers['x-payment-required']))
    const o = await req('OPTIONS', '/x402/premium', { origin: 'https://example.org', 'access-control-request-method': 'GET' })
    ok('CORS preflight still works for browsers', () => assert.ok(o.headers['access-control-allow-origin']))
  } catch (e) {
    checks.push(['✗', 'harness error :: ' + e.message])
  } finally {
    child.kill('SIGTERM')
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {}
  }
  let fail = 0
  for (const [s, n] of checks) { console.log('  ' + s + ' ' + n); if (s === '✗') fail++ }
  if (fail) { console.log(`\nHARDENING FAIL: ${fail} of ${checks.length}`); console.log(log.split('\n').slice(-6).join('\n')); process.exit(1) }
  console.log(`\nHARDENING PASS: ${checks.length} checks`)
})()
