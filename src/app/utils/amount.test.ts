import { toStroops, STROOP_DECIMALS, hasInvalidPrecision } from "./amount";

// BigInt(...) calls instead of literals so this test compiles under the
// project's older TS target (tsconfig.json targets pre-ES2020).
const b = (n: string | number) => BigInt(n);

describe("toStroops", () => {
  // Issue #3: toStroops must scale by 10**decimals, not the fixed
  // STROOP_SCALE constant. The pre-fix implementation returned 120000034
  // for ("12.34", 2) because it multiplied 12 * 10_000_000 then added
  // 34 — completely wrong for a 2-decimal asset.

  it("converts a 7-decimal (XLM) amount correctly", () => {
    expect(toStroops("1.5", 7)).toBe(b(15_000_000));
    expect(toStroops("1.5")).toBe(b(15_000_000)); // default decimals = 7
  });

  it("converts a 6-decimal (USDC-style) amount correctly", () => {
    expect(toStroops("1.5", 6)).toBe(b(1_500_000));
    expect(toStroops("123.456", 6)).toBe(b(123_456_000));
  });

  it("converts a 2-decimal stablecoin amount correctly (regression for #3)", () => {
    expect(toStroops("12.34", 2)).toBe(b(1_234));
    expect(toStroops("1", 2)).toBe(b(100));
  });

  it("handles 0 decimals (integer-only assets)", () => {
    expect(toStroops("5", 0)).toBe(b(5));
    expect(toStroops("0", 0)).toBe(b(0));
    // Anything with a fractional part on a 0-decimal asset is rejected.
    expect(toStroops("5.1", 0)).toBeNull();
  });

  it("returns null for the empty input", () => {
    expect(toStroops("")).toBeNull();
  });

  it("returns null when the input has more fractional digits than `decimals` (over-precision rejection)", () => {
    // 3 fractional digits for a 2-decimal asset must be rejected.
    expect(toStroops("12.345", 2)).toBeNull();
    // 8 fractional digits for a 7-decimal asset must be rejected.
    expect(toStroops("1.12345678", 7)).toBeNull();
  });

  it("zero-pads short fractions to `decimals` length", () => {
    // "1.5" at 7 decimals -> 1.5000000 -> 15_000_000
    expect(toStroops("1.5", 7)).toBe(b(15_000_000));
    // "1.5" at 6 decimals -> 1.500000 -> 1_500_000
    expect(toStroops("1.5", 6)).toBe(b(1_500_000));
  });

  it("handles whole-only inputs at non-default decimals", () => {
    expect(toStroops("12", 2)).toBe(b(1_200));
    expect(toStroops("12", 6)).toBe(b(12_000_000));
  });

  it("exports STROOP_DECIMALS for callers that still need the XLM default", () => {
    expect(STROOP_DECIMALS).toBe(7);
  });
});

describe("hasInvalidPrecision", () => {
  it("flags inputs with more fractional digits than allowed", () => {
    expect(hasInvalidPrecision("1.123", 2)).toBe(true);
    expect(hasInvalidPrecision("1.12", 2)).toBe(false);
    expect(hasInvalidPrecision("1", 2)).toBe(false);
  });
});
