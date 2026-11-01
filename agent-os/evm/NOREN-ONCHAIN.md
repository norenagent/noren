# Noren on-chain readiness (Robinhood Chain 4663)

Status as of the last verification run. Nothing here has been broadcast by this work;
every command below that spends gas is labelled **NOT RUN**.

## Verified

| Check | Result |
|---|---|
| `forge build` + `forge test` | 6 suites, **89 tests pass**, 0 fail |
| Fork rehearsal (`test/SpendGrantEscrowFork.t.sol`) against live 4663 state and the real USDG token | **2 pass**: the deploy script runs, `chainId` is 4663, the escrow **ships paused**, USDG has 6 decimals |
| RPC `https://rpc.mainnet.chain.robinhood.com` | `eth_chainId = 0x1237` (4663) |
| Estimated deploy cost of `SpendGrantEscrow` | about 8.54M gas, about **0.00017 ETH** at the observed 0.02 gwei |

Re-run the rehearsal any time (no key, no funds, in-memory fork):

```bash
cd agent-os/evm
git clone --depth 1 --branch v1.16.2 https://github.com/foundry-rs/forge-std lib/forge-std   # once; lib/ is gitignored
forge test --match-contract SpendGrantEscrowForkTest --fork-url https://rpc.mainnet.chain.robinhood.com -vv
```

## What is already on chain, and whose it is

`deployments.json` records contracts on 4663 from the earlier Noren deployment
(bond receipt verifier, reputation registry, RWA trade guard, guarded trade executor).
They have bytecode on chain, but their owner and trusted-attestor addresses belong to
that earlier deployment. **They are not Noren-owned and must not be described as
Noren's** until Noren deploys its own or the operator confirms control of those keys.

`SpendGrantEscrow` has **no recorded 4663 deployment** in this repo.

## Decisions required before any deploy (NOT RUN)

`DeploySpendGrantEscrow.s.sol` reads six roles from the environment. They are
security-critical and must be chosen by the operator, not defaulted:

| Variable | Meaning | Guidance |
|---|---|---|
| `USDG` | settlement token | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (verified on chain) |
| `ADMIN` | unpauses, rotates attestor/gateway | a Safe or timelock, **not** a hot key |
| `ATTESTOR` | signs the quality verdict that releases funds | the daemon's dedicated signing key, separate from `ADMIN` |
| `TREASURY` | fee sink (10% platform fee) | an address the operator controls |
| `EMERGENCY_ADMIN` | can pause and close one stuck hold | separate from `ADMIN` |
| `GATEWAY` | may release delivered v1 calls | the x402 gateway spender, if used |

Per-grant funding is capped in the contract at `MAX_ESCROW = 50 USDG`. The contract
ships paused; `ADMIN` unpauses only after the role set is verified on chain.

```bash
# NOT RUN. Needs a funded deployer key (about 0.0002 ETH on 4663) and the six roles above.
cd agent-os/evm
USDG=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 ADMIN=0x... ATTESTOR=0x... \
TREASURY=0x... EMERGENCY_ADMIN=0x... GATEWAY=0x... \
forge script script/DeploySpendGrantEscrow.s.sol \
  --rpc-url https://rpc.mainnet.chain.robinhood.com --private-key "$DEPLOYER_KEY" --broadcast
```

## Not built, by design

- The Noren token, staking and treasury contracts do not exist in this repo. Writing
  them is a product and legal decision (supply, distribution, fees), not an
  engineering default, so they were not invented.
- Agent passport / verification APIs still return `501 not_available_yet`.

## Deployed

`SpendGrantEscrow` is deployed on Robinhood Chain (chain id 4663):

- Address: `0x5efa8666d6067a3d8f4fa2bfdb0e3ed2ef7791c7`
- Deploy transaction: `0xd606548ae14bcf86bfe2a185b2ef63b868168f6f21c8f91b0e08219d28946c14`, block 101891715
- USDG: `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, platform fee 1000 bps

Current state, read from the chain: **paused**, and nothing is held in it. All six roles are set to one bootstrap key. That is a test setup. `ADMIN` should move to a Safe or timelock, and `ATTESTOR`, `TREASURY` and `EMERGENCY_ADMIN` should be separate keys, before anyone unpauses it or sends funds to it. The source is not verified on the explorer yet.
