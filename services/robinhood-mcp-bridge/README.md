# @noren/robinhood-mcp-bridge

MCP server exposing governed Robinhood crypto trading through `norend`.

Every tool proxies to the daemon `/tools/call` gate, which runs the Noren
policy capability and signs the request in the `noren-robinhood-signer`
sidecar. The private key never enters this process, and the governed order takes
the same gated path as the reads.

Add it to an MCP client:

    claude mcp add robinhood --transport stdio -- node dist/server.js

Environment:

- `NOREN_HTTP_URL` — norend HTTP gateway (default `http://127.0.0.1:8421`)
- `NOREN_AUTH_TOKEN` or `NOREN_HOME` — daemon bearer auth

Tools: `robinhood_account`, `robinhood_holdings`, `robinhood_quote`,
`robinhood_estimated_price`, `robinhood_governed_order`, `robinhood_cancel_order`,
`robinhood_receipts`, `robinhood_reputation`.
