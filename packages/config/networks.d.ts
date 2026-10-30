export const EVM_ADDRESS_REGEX: RegExp;

export interface NorenNetwork {
  key: 'mainnet' | 'testnet';
  name: string;
  chainId: number;
  caip2: string;
  explorerUrl: string;
  defaultRpcUrl: string;
}

export interface ResolvedNorenNetwork extends NorenNetwork {
  rpcUrl: string;
}

export const norenNetworks: Readonly<Record<'mainnet' | 'testnet', NorenNetwork>>;
export function resolveNetwork(key?: 'mainnet' | 'testnet', env?: Record<string, string | undefined>): ResolvedNorenNetwork;
