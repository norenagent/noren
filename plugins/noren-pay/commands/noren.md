---
description: List Noren's paid APIs, or check a wallet's payment reputation.
argument-hint: "[apis | stats | reputation <address>]"
---

Use the Noren MCP tools and report the result plainly.

Argument: $ARGUMENTS

- (empty) or `apis` → call `noren_list_apis` and show slug, price in USDG, and what each returns.
- `stats` → call `noren_gateway_stats`.
- `reputation <address>` → call `noren_reputation` with that address.

Never pay from this command. To buy an API, follow the noren-pay skill and ask the user first.
