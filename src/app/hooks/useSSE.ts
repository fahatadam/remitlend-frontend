"use client";

import { useEffect, useRef, useState } from "react";
import { useUserStore } from "../stores/useUserStore";
import {
  SseEventDedupe,
  computeSseBackoffMs,
  exceededReconnectCap,
  isAuthExpiredStatus,
} from "./sseInternals";

export type SSEStatus = "connecting" | "connected" | "disconnected";
export type RealtimeStatus = SSEStatus | "polling";

interface UseSSEOptions<T> {
  /** Full URL of the SSE endpoint. Pass null/undefined to disable. */
  url: string | null | undefined;
  /** Called for every parsed message from the stream. */
  onMessage: (data: T) => void;
  /** Called when the connection opens (backoff reset point). */
  onOpen?: () => void;
  /** Called when the connection closes with an error. */
  onError?: (error: Error) => void;
  /** Invoked while the hook is in fallback polling mode. */
  onFallbackPoll?: () => void | Promise<void>;
  /**
   * Optional: extract a stable id from a payload to suppress duplicate
   * deliveries across reconnects. Return undefined to opt the event out
   * of deduplication.
   */
  getEventId?: (data: T) => string | undefined;
}

/**
 * Generic SSE hook with exponential backoff reconnection using fetch +
 * ReadableStream. Supports a custom Authorization header that the native
 * EventSource API does not.
 *
 * Issue #5 hardening:
 *   * Exponential backoff with full jitter and a hard reconnect cap
 *     (`SSE_MAX_ATTEMPTS`); once the cap is reached we stop spinning and
 *     stay in fallback polling mode until the consumer triggers a reset.
 *   * 401 / 403 responses close the stream and force a fresh token read
 *     before reconnecting, instead of burning through reconnect attempts
 *     on an expired token.
 *   * `online` and `visibilitychange` listeners trigger an immediate
 *     reconnect attempt when the network or tab comes back.
 *   * Optional `getEventId` dedupe so reconnect replay does not double-
 *     deliver events to the UI.
 *   * Strict teardown on unmount and route change (existing behaviour,
 *     preserved).
 */
export function useSSE<T = unknown>({
  url,
  onMessage,
  onOpen,
  onError,
  onFallbackPoll,
  getEventId,
}: UseSSEOptions<T>): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const token = useUserStore((s) => s.authToken);
  const attemptRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dedupeRef = useRef<SseEventDedupe>(new SseEventDedupe());

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onFallbackPollRef = useRef(onFallbackPoll);
  onFallbackPollRef.current = onFallbackPoll;
  const getEventIdRef = useRef(getEventId);
  getEventIdRef.current = getEventId;

  useEffect(() => {
    if (!url) {
      setStatus("disconnected");
      return;
    }

    let cancelled = false;

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const startPolling = () => {
      if (pollingIntervalRef.current || !onFallbackPollRef.current) {
        return;
      }

      setStatus("polling");
      void onFallbackPollRef.current();
      pollingIntervalRef.current = setInterval(() => {
        void onFallbackPollRef.current?.();
      }, 10_000);
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      if (exceededReconnectCap(attemptRef.current)) {
        // Give up retrying and stay in fallback polling mode. A future
        // `online` / `visibilitychange` event will reset the attempt
        // counter and try again.
        startPolling();
        return;
      }
      const delay = computeSseBackoffMs(attemptRef.current);
      attemptRef.current += 1;
      timeoutRef.current = setTimeout(connect, delay);
    };

    async function connect() {
      if (cancelled) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      setStatus("connecting");
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const headers: Record<string, string> = {
          Accept: "text/event-stream",
        };

        // Read the current auth token at connect time, not capture-time.
        // After a 401 we close and reconnect, which re-reads this and
        // picks up whatever the store has at that moment (the refresh
        // flow is expected to have rotated the token by then).
        const currentToken = useUserStore.getState().authToken;
        if (currentToken) {
          headers["Authorization"] = `Bearer ${currentToken}`;
        }

        const response = await fetch(url as string, {
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          if (isAuthExpiredStatus(response.status)) {
            // Don't burn reconnect attempts on an expired token.
            attemptRef.current = 0;
            throw new Error(`SSE auth expired: ${response.status}`);
          }
          throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        stopPolling();
        setStatus("connected");
        attemptRef.current = 0;
        onOpenRef.current?.();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const lines = part.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6);
                try {
                  const data = JSON.parse(dataStr) as T;
                  const id = getEventIdRef.current?.(data);
                  if (!dedupeRef.current.markSeen(id)) {
                    // Already delivered across an earlier connection;
                    // suppress the duplicate.
                    continue;
                  }
                  onMessageRef.current(data);
                } catch (e) {
                  console.error("Failed to parse SSE data", e);
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        startPolling();
        onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
        scheduleReconnect();
      }
    }

    // Reset attempts and reconnect immediately when the network or tab
    // comes back online.
    const handleResume = () => {
      if (cancelled) return;
      attemptRef.current = 0;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      void connect();
    };
    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        handleResume();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleResume);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", handleVisibility);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      stopPolling();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleResume);
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", handleVisibility);
        }
      }
      dedupeRef.current.clear();
    };
  }, [url, token]);

  return status;
}
