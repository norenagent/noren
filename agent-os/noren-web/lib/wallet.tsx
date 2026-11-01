"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { WagmiProvider, useAccount, useDisconnect, useSignMessage } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit, useAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain } from "@reown/appkit/networks";

/**
 * Wallet connect for the public sandbox, through Reown AppKit.
 *
 * Connecting proves nothing on its own, so after connect the wallet signs one
 * plain-text message (no transaction, no gas, no approval). The signature is
 * kept in this browser for 24 h and sent with every write; the server checks it
 * and uses the wallet as the identity for rate limits.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";
const SESSION_KEY = "noren.wallet.session";
const SESSION_TTL_MS = 24 * 3600 * 1000;

export const robinhoodChain = defineChain({
  id: 4663,
  caipNetworkId: "eip155:4663",
  chainNamespace: "eip155",
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
});

type Session = { address: string; message: string; signature: string };

function issuedAt(message: string): number {
  const m = message.match(/^Issued: (.+)$/m);
  return m ? Date.parse(m[1]!) : NaN;
}

function readSession(address?: string): Session | null {
  if (typeof window === "undefined" || !address) return null;
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    if (!s || s.address.toLowerCase() !== address.toLowerCase()) return null;
    const at = issuedAt(s.message);
    if (!Number.isFinite(at) || Date.now() - at > SESSION_TTL_MS) return null;
    return s;
  } catch {
    return null;
  }
}

/** Headers the API client adds to every request once a wallet session exists. */
export function walletHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    if (!s) return {};
    return {
      "x-wallet-address": s.address,
      "x-wallet-message": btoa(s.message),
      "x-wallet-signature": s.signature,
    };
  } catch {
    return {};
  }
}

export type WalletState = {
  /** A Reown project id is configured, so the gate is active. */
  enabled: boolean;
  connected: boolean;
  /** Connected and the session message is signed: writes will be accepted. */
  ready: boolean;
  signing: boolean;
  address?: string;
  error: string;
  /** Opens the connect modal, or asks for the signature when already connected. */
  start: () => void;
  openAccount: () => void;
  disconnect: () => void;
};

const OFF: WalletState = {
  enabled: false,
  connected: false,
  ready: true,
  signing: false,
  error: "",
  start: () => {},
  openAccount: () => {},
  disconnect: () => {},
};

const Ctx = createContext<WalletState>(OFF);
export const useWallet = () => useContext(Ctx);

let adapter: WagmiAdapter | null = null;
if (PROJECT_ID) {
  adapter = new WagmiAdapter({ projectId: PROJECT_ID, networks: [robinhoodChain], ssr: true });
  createAppKit({
    adapters: [adapter],
    projectId: PROJECT_ID,
    networks: [robinhoodChain],
    defaultNetwork: robinhoodChain,
    metadata: {
      name: "Noren Sandbox",
      description: "Run agents under signed grants and a hash-chained audit log.",
      url: "https://sandbox.usenoren.xyz",
      icons: ["https://sandbox.usenoren.xyz/icon.png"],
    },
    features: { analytics: false, email: false, socials: false, onramp: false, swaps: false },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#f0fe9b",
      "--w3m-border-radius-master": "2px",
      "--w3m-font-family": "inherit",
    },
  });
}

const queryClient = new QueryClient();

function Inner({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  // Sessions are stored per browser; `stored` is bumped after each write so the
  // derived session below re-reads storage (no state set inside an effect).
  const [stored, setStored] = useState(0);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const asked = useRef<string>("");

  const session = useMemo(() => {
    void stored;
    return readSession(address);
  }, [address, stored]);

  const sign = useCallback(async () => {
    if (!address || signing) return;
    setSigning(true);
    setError("");
    try {
      const nonce = crypto.getRandomValues(new Uint32Array(2)).join("");
      const message = [
        "Noren sandbox",
        "Sign in to the public sandbox. This is a message, not a transaction: no gas, no approval.",
        `Wallet: ${address.toLowerCase()}`,
        `Issued: ${new Date().toISOString()}`,
        `Nonce: ${nonce}`,
      ].join("\n");
      const signature = await signMessageAsync({ message });
      const s: Session = { address: address.toLowerCase(), message, signature };
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setStored((n) => n + 1);
    } catch {
      setError("Signature was not given. Sign the message to use the sandbox.");
    } finally {
      setSigning(false);
    }
  }, [address, signing, signMessageAsync]);

  // Ask for the signature once per connected address.
  useEffect(() => {
    if (!isConnected || !address || session) return;
    if (asked.current === address) return;
    asked.current = address;
    void sign();
  }, [isConnected, address, session, sign]);

  const value = useMemo<WalletState>(
    () => ({
      enabled: true,
      connected: isConnected,
      ready: isConnected && !!session,
      signing,
      address,
      error,
      start: () => {
        if (!isConnected) void open({ view: "Connect" });
        else void sign();
      },
      openAccount: () => void open({ view: "Account" }),
      disconnect: () => {
        localStorage.removeItem(SESSION_KEY);
        setStored((n) => n + 1);
        asked.current = "";
        disconnect();
      },
    }),
    [isConnected, session, signing, address, error, open, sign, disconnect],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  if (!PROJECT_ID || !adapter) return <>{children}</>;
  return (
    <WagmiProvider config={adapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Inner>{children}</Inner>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function shortAddress(a?: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}
