# noren-guard (not listed yet)

This plugin is intentionally **not** in the marketplace. It drives the `covguard` binary, and no `covguard` release is
published yet (`usenoren.xyz/guard/install.sh` says so and exits). Installing it would give an MCP server that always
fails to start.

When the first signed release exists, add it back to `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`
and re-run `claude plugin validate`.
