import {
  SseEventDedupe,
  computeSseBackoffMs,
  exceededReconnectCap,
  isAuthExpiredStatus,
  SSE_INITIAL_BACKOFF_MS,
  SSE_MAX_BACKOFF_MS,
  SSE_MAX_ATTEMPTS,
} from "./sseInternals";

describe("computeSseBackoffMs", () => {
  it("doubles up to SSE_MAX_BACKOFF_MS with deterministic jitter source", () => {
    // random=1 → full exponential delay (no shrinking).
    expect(computeSseBackoffMs(0, () => 1)).toBe(SSE_INITIAL_BACKOFF_MS);
    expect(computeSseBackoffMs(1, () => 1)).toBe(SSE_INITIAL_BACKOFF_MS * 2);
    expect(computeSseBackoffMs(2, () => 1)).toBe(SSE_INITIAL_BACKOFF_MS * 4);
    expect(computeSseBackoffMs(10, () => 1)).toBe(SSE_MAX_BACKOFF_MS);
    expect(computeSseBackoffMs(100, () => 1)).toBe(SSE_MAX_BACKOFF_MS);
  });

  it("applies full jitter — random=0 collapses to zero, random=0.5 halves the delay", () => {
    expect(computeSseBackoffMs(3, () => 0)).toBe(0);
    expect(computeSseBackoffMs(3, () => 0.5)).toBe(SSE_INITIAL_BACKOFF_MS * 4);
  });

  it("clamps negative or fractional attempts", () => {
    expect(computeSseBackoffMs(-5, () => 1)).toBe(SSE_INITIAL_BACKOFF_MS);
    expect(computeSseBackoffMs(0.7, () => 1)).toBe(SSE_INITIAL_BACKOFF_MS);
  });
});

describe("exceededReconnectCap", () => {
  it("returns true at and beyond SSE_MAX_ATTEMPTS", () => {
    expect(exceededReconnectCap(SSE_MAX_ATTEMPTS - 1)).toBe(false);
    expect(exceededReconnectCap(SSE_MAX_ATTEMPTS)).toBe(true);
    expect(exceededReconnectCap(SSE_MAX_ATTEMPTS + 5)).toBe(true);
  });
});

describe("isAuthExpiredStatus", () => {
  it("flags 401 and 403", () => {
    expect(isAuthExpiredStatus(401)).toBe(true);
    expect(isAuthExpiredStatus(403)).toBe(true);
  });
  it("does not flag other statuses", () => {
    expect(isAuthExpiredStatus(200)).toBe(false);
    expect(isAuthExpiredStatus(500)).toBe(false);
    expect(isAuthExpiredStatus(429)).toBe(false);
  });
});

describe("SseEventDedupe", () => {
  it("returns true once per unique id and false on repeats", () => {
    const d = new SseEventDedupe();
    expect(d.markSeen("evt-1")).toBe(true);
    expect(d.markSeen("evt-1")).toBe(false);
    expect(d.markSeen("evt-2")).toBe(true);
  });

  it("treats null / undefined / empty ids as always-deliver", () => {
    const d = new SseEventDedupe();
    // Without an id, we have no basis for dedup — let the event through
    // every time rather than swallowing it.
    expect(d.markSeen(null)).toBe(true);
    expect(d.markSeen(undefined)).toBe(true);
    expect(d.markSeen("")).toBe(true);
    expect(d.size()).toBe(0);
  });

  it("evicts the oldest entry once the window is full", () => {
    const d = new SseEventDedupe(3);
    expect(d.markSeen("a")).toBe(true);
    expect(d.markSeen("b")).toBe(true);
    expect(d.markSeen("c")).toBe(true);
    // Tracker is full; marking "d" evicts the oldest ("a") and the size
    // stays at the window cap.
    expect(d.markSeen("d")).toBe(true);
    expect(d.size()).toBe(3);
    // "a" was evicted, so it is treated as fresh again.
    expect(d.markSeen("a")).toBe(true);
    // "c" was admitted before "d" and is still tracked.
    expect(d.markSeen("c")).toBe(false);
  });

  it("clear() resets the tracker", () => {
    const d = new SseEventDedupe();
    d.markSeen("a");
    d.clear();
    expect(d.size()).toBe(0);
    expect(d.markSeen("a")).toBe(true);
  });
});
