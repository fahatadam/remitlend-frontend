/**
 * stores/useUIStore.ts
 *
 * Zustand store for transient UI state — modals, toasts, and
 * global loading indicators.
 *
 * Responsibilities:
 *  - Modal visibility + per-modal data payload
 *  - Toast notification queue
 *  - Global (page-level) loading overlay
 *
 * Design decision: most UI state starts fresh, but settings (sound/motion) are persisted.
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// ─── Toast types ──────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  /** Unique identifier — auto-generated if not provided */
  id: string;
  message: string;
  variant: ToastVariant;
  /** Duration in ms before auto-dismiss. 0 = never auto-dismiss */
  duration: number;
}

// ─── Modal types ──────────────────────────────────────────────────────────────

/** All modal identifiers in the app. Add new modals here as the app grows. */
export type ModalId =
  | "connectWallet"
  | "confirmLoan"
  | "confirmRemittance"
  | "kycVerification"
  | "transactionDetails";

export interface ModalState {
  isOpen: boolean;
  /** Arbitrary payload passed to the modal for context */
  data?: unknown;
}

// ─── Store types ──────────────────────────────────────────────────────────────

interface UIState {
  /** Per-modal open state and data */
  modals: Record<ModalId, ModalState>;
  /** FIFO queue of pending toast notifications */
  toasts: Toast[];
  /** True while a global loading spinner should be shown */
  isGlobalLoading: boolean;
  globalLoadingMessage: string | null;
  /** Global settings for accessibility and comfort */
  soundEnabled: boolean;
  reducedMotion: boolean;
}

interface UIActions {
  // ── Modals ────────────────────────────────────────────────────────────────

  /** Open a specific modal, optionally with a data payload */
  openModal: (id: ModalId, data?: unknown) => void;
  /** Close a specific modal */
  closeModal: (id: ModalId) => void;
  /** Close all open modals at once */
  closeAllModals: () => void;

  // ── Toasts ────────────────────────────────────────────────────────────────

  /**
   * Add a toast notification.
   * Returns the generated id so the caller can dismiss it programmatically.
   */
  addToast: (toast: Omit<Toast, "id"> & { id?: string }) => string;
  /** Remove a toast by id */
  dismissToast: (id: string) => void;
  /** Clear all toasts */
  clearToasts: () => void;

  // ── Global loading ────────────────────────────────────────────────────────

  showGlobalLoading: (message?: string) => void;
  hideGlobalLoading: () => void;

  // ── Settings ──────────────────────────────────────────────────────────────

  setSoundEnabled: (enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
}

export type UIStore = UIState & UIActions;

// ─── Default modal state ──────────────────────────────────────────────────────

const ALL_MODALS: ModalId[] = [
  "connectWallet",
  "confirmLoan",
  "confirmRemittance",
  "kycVerification",
  "transactionDetails",
];

const defaultModals = Object.fromEntries(ALL_MODALS.map((id) => [id, { isOpen: false }])) as Record<
  ModalId,
  ModalState
>;

// ─── Initial state ────────────────────────────────────────────────────────────

const getInitialReducedMotion = () => {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
};

const initialState: UIState = {
  modals: defaultModals,
  toasts: [],
  isGlobalLoading: false,
  globalLoadingMessage: null,
  soundEnabled: true,
  reducedMotion: getInitialReducedMotion(),
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        // ── Modals ──────────────────────────────────────────────────────────────

        openModal: (id, data) =>
          set(
            (state) => ({
              modals: {
                ...state.modals,
                [id]: { isOpen: true, data },
              },
            }),
            false,
            `ui/openModal:${id}`,
          ),

        closeModal: (id) =>
          set(
            (state) => ({
              modals: {
                ...state.modals,
                [id]: { isOpen: false, data: undefined },
              },
            }),
            false,
            `ui/closeModal:${id}`,
          ),

        closeAllModals: () => set({ modals: defaultModals }, false, "ui/closeAllModals"),

        // ── Toasts ──────────────────────────────────────────────────────────────

        addToast: (toast) => {
          const id = toast.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const duration = toast.duration ?? 4000;
          const fullToast: Toast = {
            ...toast,
            id,
            duration,
          };
          set((state) => ({ toasts: [...state.toasts, fullToast] }), false, "ui/addToast");
          return id;
        },

        dismissToast: (id) =>
          set(
            (state) => ({
              toasts: state.toasts.filter((t) => t.id !== id),
            }),
            false,
            "ui/dismissToast",
          ),

        clearToasts: () => set({ toasts: [] }, false, "ui/clearToasts"),

        // ── Global loading ───────────────────────────────────────────────────────

        showGlobalLoading: (message) =>
          set(
            { isGlobalLoading: true, globalLoadingMessage: message ?? null },
            false,
            "ui/showGlobalLoading",
          ),

        hideGlobalLoading: () =>
          set(
            { isGlobalLoading: false, globalLoadingMessage: null },
            false,
            "ui/hideGlobalLoading",
          ),

        // ── Settings ─────────────────────────────────────────────────────────────

        setSoundEnabled: (enabled) => set({ soundEnabled: enabled }, false, "ui/setSoundEnabled"),

        setReducedMotion: (reduced) =>
          set({ reducedMotion: reduced }, false, "ui/setReducedMotion"),
      }),
      {
        name: "ui-store",
        partialize: (state) => ({
          soundEnabled: state.soundEnabled,
          reducedMotion: state.reducedMotion,
        }),
      },
    ),
    { name: "UIStore" },
  ),
);

if (typeof window !== "undefined") {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", (e) => {
    useUIStore.getState().setReducedMotion(e.matches);
  });
}

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectModal = (id: ModalId) => (state: UIStore) => state.modals[id];
export const selectToasts = (state: UIStore) => state.toasts;
export const selectIsGlobalLoading = (state: UIStore) => state.isGlobalLoading;
export const selectGlobalLoadingMessage = (state: UIStore) => state.globalLoadingMessage;
export const selectSoundEnabled = (state: UIStore) => state.soundEnabled;
export const selectReducedMotion = (state: UIStore) => state.reducedMotion;
