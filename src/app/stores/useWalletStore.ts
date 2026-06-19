/**
 * stores/useWalletStore.ts
 *
 * Zustand store for Web3 wallet connection state.
 *
 * Responsibilities:
 *  - Track the connected wallet address
 *  - Track the current chain / network
 *  - Track available token balances
 *  - Provide actions to connect / disconnect
 *
 * Design decision: actual wallet provider interaction (ethers / wagmi calls)
 * lives in a separate hook or service. This store is the single source of truth
 * for the resulting state so any component can read it without a provider tree.
 */

import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

// ─── Types ───────────────────────────────────────────────────────────────────

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export type WalletErrorKind =
  | "not_installed"
  | "user_rejected"
  | "locked"
  | "network_mismatch"
  | "generic"
  | null;

export interface TokenBalance {
  symbol: string;
  /** Human-readable amount, e.g. "1.234" */
  amount: string;
  /** USD value, or null if price unavailable */
  usdValue: number | null;
}

export interface WalletNetwork {
  chainId: number;
  name: string;
  /** Whether this is one of the app's supported networks */
  isSupported: boolean;
}

interface WalletState {
  /** Wallet connection status */
  status: WalletStatus;
  /** Connected wallet address (checksummed) — null when disconnected */
  address: string | null;
  /** Current network info */
  network: WalletNetwork | null;
  /** Token balances for the connected wallet */
  balances: TokenBalance[];
  /** True while fetching/refreshing balances */
  isLoadingBalances: boolean;
  /** Human-readable error message */
  error: string | null;
  /** Structured error kind for distinct UI treatment */
  errorKind: WalletErrorKind;
  /** True when Freighter's active network differs from the app's target network */
  networkMismatch: boolean;
  /** Whether the app should try to restore the wallet on refresh */
  shouldAutoReconnect: boolean;
}

interface WalletActions {
  /** Call after a successful wallet.connect() to store the result */
  setConnected: (address: string, network: WalletNetwork) => void;
  /** Call on disconnect or user-initiated Sign Out with wallet */
  disconnect: () => void;
  /** Update balances after fetching from the chain */
  setBalances: (balances: TokenBalance[]) => void;
  /** Update network when the user switches chains */
  setNetwork: (network: WalletNetwork) => void;
  setStatus: (status: WalletStatus) => void;
  setError: (error: string | null, status?: WalletStatus, kind?: WalletErrorKind) => void;
  setLoadingBalances: (loading: boolean) => void;
  setNetworkMismatch: (mismatch: boolean) => void;
}

export type WalletStore = WalletState & WalletActions;

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: WalletState = {
  status: "disconnected",
  address: null,
  network: null,
  balances: [],
  isLoadingBalances: false,
  error: null,
  errorKind: null,
  networkMismatch: false,
  shouldAutoReconnect: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWalletStore = create<WalletStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setConnected: (address, network) =>
          set(
            {
              status: "connected",
              address,
              network,
              error: null,
              shouldAutoReconnect: true,
            },
            false,
            "wallet/setConnected",
          ),

        disconnect: () =>
          set(
            {
              ...initialState,
            },
            false,
            "wallet/disconnect",
          ),

        setBalances: (balances) =>
          set({ balances, isLoadingBalances: false }, false, "wallet/setBalances"),

        setNetwork: (network) => set({ network }, false, "wallet/setNetwork"),

        setStatus: (status) => set({ status }, false, "wallet/setStatus"),

        setError: (error, status = "error", kind = "generic") =>
          set(
            { error, status, errorKind: error === null ? null : kind, isLoadingBalances: false },
            false,
            "wallet/setError",
          ),

        setLoadingBalances: (isLoadingBalances) =>
          set({ isLoadingBalances }, false, "wallet/setLoadingBalances"),

        setNetworkMismatch: (networkMismatch) =>
          set({ networkMismatch }, false, "wallet/setNetworkMismatch"),
      }),
      {
        name: "remitlend-wallet",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          status: state.status,
          address: state.address,
          network: state.network,
          balances: state.balances,
          shouldAutoReconnect: state.shouldAutoReconnect,
        }),
      },
    ),
    { name: "WalletStore" },
  ),
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectWalletAddress = (state: WalletStore) => state.address;
export const selectWalletStatus = (state: WalletStore) => state.status;
export const selectIsWalletConnected = (state: WalletStore) => state.status === "connected";
export const selectWalletNetwork = (state: WalletStore) => state.network;
export const selectWalletBalances = (state: WalletStore) => state.balances;
export const selectWalletError = (state: WalletStore) => state.error;
export const selectWalletErrorKind = (state: WalletStore) => state.errorKind;
export const selectNetworkMismatch = (state: WalletStore) => state.networkMismatch;
export const selectWalletShouldAutoReconnect = (state: WalletStore) => state.shouldAutoReconnect;
