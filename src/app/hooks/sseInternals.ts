/**
 * Pure helpers backing the `useSSE` reconnect state machine — issue #5.
 *
 * Extracted so the backoff, dedup, and 401 handling can be unit-tested
 * without standing up a real EventSource / fetch mock.
 */

export const SSE_INITIAL_BACKOFF_MS = 1_000;
export const SSE_MAX_BACKOFF_MS = 30_000;
export const SSE_MAX_ATTEMPTS = 8;
export const SSE_DEDUPE_WINDOW = 256;

/**
 * Exponential backoff with full jitter for SSE reconnect. Uses Math.random
 * by default; tests pass a deterministic source.
 */
export function computeSseBackoffMs(attempt: number, random: () => number = Math.random): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const exp = Math.min(SSE_INITIAL_BACKOFF_MS * 2 ** safeAttempt, SSE_MAX_BACKOFF_MS);
  // Full-jitter: sleep ∈ [0, exp]. Removes the synchronized-thundering-herd
  // shape of a deterministic doubling backoff.
  return Math.round(exp * random());
}

/**
 * True iff this attempt count has exceeded the reconnect cap. Callers use
 * this to drop the stream to fallback polling permanently rather than
 * spinning on a hard failure.
 */
export function exceededReconnectCap(attempt: number): boolean {
  return attempt >= SSE_MAX_ATTEMPTS;
}

/**
 * Detect when the SSE response should trigger an auth-refresh attempt
 * rather than a normal reconnect (so we don't burn through reconnect
 * attempts spinning on the same expired token).
 */
export function isAuthExpiredStatus(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * Bounded LRU-ish dedupe of recently-seen SSE event identifiers. Identifiers
 * are domain-supplied (event id, transaction hash, notification id) — we
 * never invent them. `markSeen` returns true the first time an id is seen,
 * false on every subsequent call.
 */
export class SseEventDedupe {
  private readonly window: number;
  private readonly seen: Map<string, true>;

  constructor(window: number = SSE_DEDUPE_WINDOW) {
    this.window = Math.max(1, Math.floor(window));
    this.seen = new Map();
  }

  markSeen(id: string | null | undefined): boolean {
    if (id === null || id === undefined || id === "") return true;
    if (this.seen.has(id)) return false;
    if (this.seen.size >= this.window) {
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    this.seen.set(id, true);
    return true;
  }

  size(): number {
    return this.seen.size;
  }

  clear(): void {
    this.seen.clear();
  }
}
