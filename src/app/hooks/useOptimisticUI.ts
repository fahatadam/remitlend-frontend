"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface OptimisticTransaction {
  id: string;
  status: "idle" | "pending" | "success" | "error";
  message: string;
  progress?: number;
  txHash?: string;
  error?: string;
  startTime: number;
}

interface OptimisticUIState {
  transactions: Record<string, OptimisticTransaction>;
}

interface OptimisticUIActions {
  startTransaction: (id: string, message: string) => void;
  updateProgress: (id: string, progress: number, message?: string) => void;
  completeTransaction: (id: string, txHash?: string, message?: string) => void;
  failTransaction: (id: string, error: string) => void;
  clearTransaction: (id: string) => void;
  getTransaction: (id: string) => OptimisticTransaction | undefined;
}

export type OptimisticUIStore = OptimisticUIState & OptimisticUIActions;

export const useOptimisticUI = create<OptimisticUIStore>()(
  devtools(
    (set, get) => ({
      transactions: {},

      startTransaction: (id, message) =>
        set((state) => ({
          transactions: {
            ...state.transactions,
            [id]: {
              id,
              status: "pending",
              message,
              progress: 0,
              startTime: Date.now(),
            },
          },
        })),

      updateProgress: (id, progress, message) =>
        set((state) => {
          const tx = state.transactions[id];
          if (!tx) return state;
          return {
            transactions: {
              ...state.transactions,
              [id]: {
                ...tx,
                progress,
                ...(message ? { message } : {}),
              },
            },
          };
        }),

      completeTransaction: (id, txHash, message) =>
        set((state) => {
          const tx = state.transactions[id];
          if (!tx) return state;
          return {
            transactions: {
              ...state.transactions,
              [id]: {
                ...tx,
                status: "success",
                progress: 100,
                txHash,
                ...(message ? { message } : {}),
              },
            },
          };
        }),

      failTransaction: (id, error) =>
        set((state) => {
          const tx = state.transactions[id];
          if (!tx) return state;
          return {
            transactions: {
              ...state.transactions,
              [id]: {
                ...tx,
                status: "error",
                error,
              },
            },
          };
        }),

      clearTransaction: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.transactions;
          return { transactions: rest };
        }),

      getTransaction: (id) => get().transactions[id],
    }),
    { name: "OptimisticUIStore" },
  ),
);
