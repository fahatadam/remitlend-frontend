"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type {
  TokenBalance,
  WalletErrorKind,
  WalletNetwork,
  WalletStatus,
} from "../../stores/useWalletStore";
import { useWalletStore } from "../../stores/useWalletStore";
import { useUserStore } from "../../stores/useUserStore";
import { useQueryClient } from "@tanstack/react-query";

/** The Stellar network the app is configured to operate on. */
export const APP_TARGET_NETWORK = (
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET"
).toUpperCase();

type FreighterApi = typeof import("@stellar/freighter-api");

interface ExtendedFreighterApi {
  isConnected: () => Promise<{ isConnected: boolean; error?: string }>;
  requestAccess: () => Promise<FreighterAddressResult>;
  getAddress: () => Promise<FreighterAddressResult>;
  signTransaction: (
    xdr: string,
    opts?: { network?: string; networkPassphrase?: string },
  ) => Promise<string | { signedTxXdr?: string; error?: string }>;
  getNetworkDetails?: () => Promise<FreighterNetworkResult>;
  getNetwork?: () => Promise<FreighterNetworkResult>;
  watchAddress?: (callback: (address: string) => void) => () => void;
  watchNetwork?: (callback: (network: string) => void) => () => void;
}

interface WalletProviderContextValue {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshWallet: () => Promise<void>;
  isFreighterAvailable: boolean;
  signTransaction: (unsignedTxXdr: string) => Promise<string>;
  appTargetNetwork: string;
}

interface WalletProviderProps {
  children: ReactNode;
}

interface FreighterAddressResult {
  address?: string;
  error?: unknown;
}

interface FreighterNetworkResult {
  network?: string;
  networkUrl?: string;
  error?: unknown;
}

interface HorizonBalance {
  balance: string;
  asset_type: "native" | "credit_alphanum4" | "credit_alphanum12" | "liquidity_pool_shares";
  asset_code?: string;
}

const WalletProviderContext = createContext<WalletProviderContextValue | null>(null);

const NETWORK_CHAIN_IDS: Record<string, number> = {
  PUBLIC: 1,
  TESTNET: 2,
  FUTURENET: 3,
  STANDALONE: 4,
};

function normalizeWalletError(error: unknown): string {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    if ("error" in error) {
      return normalizeWalletError(error.error);
    }
  }

  return "Unable to complete the wallet action.";
}

/**
 * Classify a raw Freighter error into a structured kind so the UI can render
 * distinct, actionable messages for each failure mode.
 */
function classifyWalletError(error: unknown): { message: string; kind: WalletErrorKind } {
  const message = normalizeWalletError(error);
  const lower = message.toLowerCase();

  if (lower.includes("not installed") || lower.includes("unavailable")) {
    return {
      message: "Freighter is not installed. Install it from freighter.app and refresh.",
      kind: "not_installed",
    };
  }

  if (
    lower.includes("user declined") ||
    lower.includes("user rejected") ||
    lower.includes("rejected") ||
    lower.includes("denied")
  ) {
    return {
      message: "Connection request was rejected. Approve the connection in Freighter to continue.",
      kind: "user_rejected",
    };
  }

  if (lower.includes("locked") || lower.includes("password")) {
    return {
      message: "Freighter is locked. Unlock your wallet and try again.",
      kind: "locked",
    };
  }

  return { message, kind: "generic" };
}

function mapWalletNetwork(networkName: string | undefined): WalletNetwork {
  const normalized = (networkName ?? "UNKNOWN").toUpperCase();

  return {
    chainId: NETWORK_CHAIN_IDS[normalized] ?? 0,
    name: normalized,
    isSupported: normalized in NETWORK_CHAIN_IDS,
  };
}

function getFallbackHorizonUrl(networkName: string | undefined): string {
  const normalized = (networkName ?? "").toUpperCase();

  if (normalized === "PUBLIC") {
    return "https://horizon.stellar.org";
  }

  return "https://horizon-testnet.stellar.org";
}

function mapBalances(balances: HorizonBalance[] | undefined): TokenBalance[] {
  return (balances ?? []).map((balance) => ({
    symbol: balance.asset_type === "native" ? "XLM" : (balance.asset_code ?? "ASSET"),
    amount: balance.balance,
    usdValue: null,
  }));
}

async function loadFreighterApi(): Promise<FreighterApi> {
  return import("@stellar/freighter-api");
}

export function WalletProvider({ children }: WalletProviderProps) {
  const address = useWalletStore((state) => state.address);
  const shouldAutoReconnect = useWalletStore((state) => state.shouldAutoReconnect);
  const setConnected = useWalletStore((state) => state.setConnected);
  const disconnect = useWalletStore((state) => state.disconnect);
  const setBalances = useWalletStore((state) => state.setBalances);
  const setNetwork = useWalletStore((state) => state.setNetwork);
  const setStatus = useWalletStore((state) => state.setStatus);
  const setError = useWalletStore((state) => state.setError);
  const setLoadingBalances = useWalletStore((state) => state.setLoadingBalances);
  const setNetworkMismatch = useWalletStore((state) => state.setNetworkMismatch);
  const clearUser = useUserStore((state) => state.clearUser);
  const queryClient = useQueryClient();
  const [isFreighterAvailable, setIsFreighterAvailable] = useState(false);
  const syncRef = useRef<Promise<void> | null>(null);

  async function refreshBalances(nextAddress: string, horizonUrl: string, status: WalletStatus) {
    setLoadingBalances(true);

    try {
      const response = await fetch(`${horizonUrl}/accounts/${nextAddress}`);

      if (response.status === 404) {
        setBalances([]);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch balances from Horizon (${response.status})`);
      }

      const data = (await response.json()) as { balances?: HorizonBalance[] };
      setBalances(mapBalances(data.balances));
      setError(null, status);
    } catch (error) {
      setBalances([]);
      setError(normalizeWalletError(error), status);
    }
  }

  async function syncWallet(interactive: boolean) {
    if (syncRef.current) {
      return syncRef.current;
    }

    const task = (async () => {
      const api = (await loadFreighterApi()) as unknown as ExtendedFreighterApi;
      const installationState = await api.isConnected();

      if (installationState.error || !installationState.isConnected) {
        setIsFreighterAvailable(false);
        throw new Error("Freighter is not installed or unavailable in this browser.");
      }

      setIsFreighterAvailable(true);

      const addressResult = (
        interactive ? await api.requestAccess() : await api.getAddress()
      ) as FreighterAddressResult;

      if (addressResult.error) {
        throw new Error(normalizeWalletError(addressResult.error));
      }

      if (!addressResult.address) {
        if (!interactive) {
          disconnect();
          return;
        }

        throw new Error("No Stellar address was returned by Freighter.");
      }

      const networkResult: FreighterNetworkResult = api.getNetworkDetails
        ? await api.getNetworkDetails()
        : api.getNetwork
          ? await api.getNetwork()
          : { error: "Network info not available." };

      if (networkResult.error) {
        throw new Error(normalizeWalletError(networkResult.error));
      }

      const walletNetwork = mapWalletNetwork(networkResult.network);
      const isMismatch = walletNetwork.isSupported && walletNetwork.name !== APP_TARGET_NETWORK;
      const nextStatus: WalletStatus =
        walletNetwork.isSupported && !isMismatch ? "connected" : "error";

      setConnected(addressResult.address, walletNetwork);
      setNetwork(walletNetwork);
      setStatus(nextStatus);
      setNetworkMismatch(isMismatch);

      if (!walletNetwork.isSupported) {
        setError(
          `Unsupported wallet network: ${walletNetwork.name}. Switch to PUBLIC, TESTNET, FUTURENET, or STANDALONE.`,
          "error",
          "generic",
        );
      } else if (isMismatch) {
        setError(
          `Network mismatch: Freighter is on ${walletNetwork.name} but this app targets ${APP_TARGET_NETWORK}. Switch networks in Freighter to continue.`,
          "error",
          "network_mismatch",
        );
      } else {
        setError(null, "connected");
      }

      await refreshBalances(
        addressResult.address,
        networkResult.networkUrl || getFallbackHorizonUrl(networkResult.network),
        nextStatus,
      );
    })()
      .catch((error) => {
        if (interactive) {
          disconnect();
          const { message, kind } = classifyWalletError(error);
          setError(message, "error", kind);
          throw error;
        }
      })
      .finally(() => {
        syncRef.current = null;
      });

    syncRef.current = task;
    return task;
  }

  async function connectWallet() {
    setStatus("connecting");
    setError(null, "connecting");
    await syncWallet(true);
  }

  function disconnectWallet() {
    disconnect();
    clearUser();
    queryClient.clear();
  }

  const NETWORK_PASSPHRASES: Record<string, string> = {
    PUBLIC: "Public Global Stellar Network ; October 2015",
    TESTNET: "Test SDF Network ; September 2015",
    FUTURENET: "Test SDF Future Network ; October 2022",
    STANDALONE: "Standalone Network ; Separate from SDF",
  };

  async function signTransaction(unsignedTxXdr: string): Promise<string> {
    const api = (await loadFreighterApi()) as unknown as ExtendedFreighterApi;
    const networkName = useWalletStore.getState().network?.name ?? "TESTNET";
    const networkPassphrase = NETWORK_PASSPHRASES[networkName] ?? NETWORK_PASSPHRASES.TESTNET;

    const result = await api.signTransaction(unsignedTxXdr, {
      networkPassphrase,
    });

    if (typeof result === "string") {
      return result;
    }

    if (result.error) {
      throw new Error(normalizeWalletError(result.error));
    }

    if (result.signedTxXdr) {
      return result.signedTxXdr;
    }

    throw new Error("Signing failed: No signed transaction returned.");
  }

  async function refreshWallet() {
    if (!shouldAutoReconnect && !address) return;
    await syncWallet(false);
  }

  // Initial check and Auto-reconnect
  useEffect(() => {
    let cancelled = false;

    void loadFreighterApi()
      .then((api) => api.isConnected())
      .then(async (result) => {
        if (!cancelled) {
          const isAvailable = Boolean(result.isConnected && !result.error);
          setIsFreighterAvailable(isAvailable);

          if (isAvailable && shouldAutoReconnect) {
            await refreshWallet();
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsFreighterAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldAutoReconnect]);

  // Event Listeners
  useEffect(() => {
    let unwatchAddress: (() => void) | undefined;
    let unwatchNetwork: (() => void) | undefined;

    void loadFreighterApi().then((apiRaw) => {
      const api = apiRaw as unknown as ExtendedFreighterApi;

      if (typeof api.watchAddress === "function") {
        unwatchAddress = api.watchAddress((newAddress: string) => {
          if (!newAddress && address) {
            disconnect();
          } else if (newAddress && newAddress !== address) {
            void refreshWallet();
          }
        });
      }

      if (typeof api.watchNetwork === "function") {
        unwatchNetwork = api.watchNetwork((newNetwork: string) => {
          void refreshWallet();
        });
      }
    });

    return () => {
      if (unwatchAddress) unwatchAddress();
      if (unwatchNetwork) unwatchNetwork();
    };
  }, [address]);

  return (
    <WalletProviderContext.Provider
      value={{
        connectWallet,
        disconnectWallet,
        refreshWallet,
        isFreighterAvailable,
        signTransaction,
        appTargetNetwork: APP_TARGET_NETWORK,
      }}
    >
      {children}
    </WalletProviderContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletProviderContext);

  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider.");
  }

  return context;
}
