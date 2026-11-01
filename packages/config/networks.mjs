export const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

export const norenNetworks = Object.freeze({
  mainnet: Object.freeze({
    key: 'mainnet',
    name: 'Robinhood Chain',
    chainId: 4663,
    caip2: 'eip155:4663',
    explorerUrl: 'https://robinhoodchain.blockscout.com',
    defaultRpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  }),
  testnet: Object.freeze({
    key: 'testnet',
    name: 'Robinhood Chain Testnet',
    chainId: 46630,
    caip2: 'eip155:46630',
    explorerUrl: 'https://explorer.testnet.chain.robinhood.com',
    defaultRpcUrl: 'https://rpc.testnet.chain.robinhood.com',
  }),
});

export function resolveNetwork(key = 'mainnet', env = process.env) {
  const base = norenNetworks[key];
  if (!base) throw new Error(`unknown network: ${key}`);
  return { ...base, rpcUrl: env[`NOREN_${key.toUpperCase()}_RPC_URL`] ?? base.defaultRpcUrl };
}
