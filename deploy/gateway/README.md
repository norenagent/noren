# Gateway hardening (x402 gateway at gateway.usenoren.xyz)

The gateway runs from a directory outside this repository and is not under version control yet.
These files record what was changed and how it was verified.

## Changes (2026-10-29)
- Security headers on every response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
  `X-Frame-Options: DENY`, `Permissions-Policy`, `Cross-Origin-Resource-Policy: cross-origin`.
  CORS stays `*` because this is a public pay-per-call API.
- `/metrics` requires `Authorization: Bearer <NOREN_METRICS_TOKEN>` when that variable is set.
- `@x402/core` 2.25.0 to 2.29.0, which moves `zod` from 3.25.76 to 4.6.7 and clears GHSA-mrhx-c7xc-m3w5
  (`npm audit --omit=dev`: 0 vulnerabilities).

## Verification
- `test/smoke.js`: 24 checks, unchanged and passing before and after.
- `hardening.test.js` (this folder, copy to `test/hardening.js`): 26 checks, written first and failing
  16 of 26 before the change, 26 of 26 after.
- On-wire `PAYMENT-REQUIRED` header: byte-identical between 2.25.0 and 2.29.0 for the same input.
- 240 injection requests (12 routes x 20 payloads) before the change: no SQL error text, no schema
  disclosure, no table dropped, no row count decreased, `integrity_check: ok`.

## Not verified
- A real paid request through the upgraded code. `test/pay-once.js` still points at the retired host and
  needs a funded payer key.

## Rollback
Code and lockfile before the change: `$HOME/backups/gateway/` (`gateway-code-*.tgz`,
`package.json.pre-upgrade`, `package-lock.json.pre-upgrade`). Restore, `npm ci --omit=dev`, restart `noren-proxy`.
