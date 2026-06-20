# Bundle Size Budget

> **Target device**: Low-bandwidth mobile (≈ 300 kbps downlink, mid-range Android)
> **Measurement tool**: `npm run analyze` → opens `@next/bundle-analyzer` treemap in browser
> **Reported metric**: Next.js **First Load JS** per route (shown in `next build` output)

---

## How to measure

```bash
# 1. Run the analyzer (opens treemap in browser)
npm run analyze

# 2. Capture the per-route First Load JS sizes printed by `next build`
npm run build
```

The `next build` stdout table ("Route (app)") is the source of truth for
the numbers in this document. Copy the **First Load JS** column here after
each significant PR that touches charts, animations, or large dependencies.

---

## Per-route JS budget

| Route                   | Budget   | Baseline (pre-optimization) | Target (post-optimization) |
| ----------------------- | -------- | --------------------------- | -------------------------- |
| `/[locale]` (dashboard) | ≤ 200 kB | ~185 kB                     | ≤ 160 kB                   |
| `/[locale]/analytics`   | ≤ 250 kB | ~310 kB (recharts eager)    | ≤ 200 kB                   |
| `/[locale]/kingdom`     | ≤ 220 kB | ~280 kB (framer eager)      | ≤ 190 kB                   |
| All other routes        | ≤ 180 kB | —                           | ≤ 180 kB                   |

> **Budgets are enforced via code review**, not automated CI at this stage.
> A follow-up issue should add `bundlesize` or a `next build` size assertion to CI.

---

## Lazy-loaded chunks (not in initial bundle)

The following modules are split into async chunks and fetched only when the
user navigates to the relevant route or triggers the relevant interaction:

| Chunk / Module                  | Split at                          | Trigger                   |
| ------------------------------- | --------------------------------- | ------------------------- |
| `recharts` + chart components   | `FinancialPerformanceDashboard`   | `/analytics` page render  |
| `framer-motion` runtime         | `XPGainAnimation`, `LevelUpModal` | First gamification event  |
| `KingdomProgressWidget`         | `kingdom/page.tsx`                | `/kingdom` route render   |
| `AchievementsPanel`             | `kingdom/page.tsx`                | `/kingdom` route render   |
| `GamificationSettings`          | `kingdom/page.tsx`                | `/kingdom` route render   |
| `FinancialPerformanceDashboard` | `analytics/page.tsx`              | `/analytics` route render |

---

## Dependency sizes (uncompressed / gzip)

Reference sizes from the `npm run analyze` treemap (update after major version bumps):

| Package                 | Uncompressed | Notes                                                           |
| ----------------------- | ------------ | --------------------------------------------------------------- |
| `recharts`              | ~500 kB      | Area/Line/Bar charts. Split via `next/dynamic`.                 |
| `framer-motion`         | ~120 kB      | Animation runtime. Split via `next/dynamic`.                    |
| `lottie-react`          | ~220 kB      | Not currently used in any component. Remove if unused after V2. |
| `@stellar/stellar-sdk`  | ~300 kB      | Required for wallet. Cannot be split further.                   |
| `@tanstack/react-query` | ~35 kB       | Low impact.                                                     |
| `zustand`               | ~5 kB        | Low impact.                                                     |

---

## Before/After: First Load JS (estimated)

> These are engineering estimates. Replace with real `next build` output numbers
> after the optimization PR lands and the project builds successfully.

### `/[locale]/analytics`

| State                    | First Load JS | Delta       |
| ------------------------ | ------------- | ----------- |
| Before (recharts eager)  | ~310 kB       | baseline    |
| After (recharts dynamic) | ~190 kB       | **−120 kB** |

### `/[locale]/kingdom`

| State                                         | First Load JS | Delta       |
| --------------------------------------------- | ------------- | ----------- |
| Before (framer-motion eager in gamification)  | ~280 kB       | baseline    |
| After (framer-motion dynamic in gamification) | ~170 kB       | **−110 kB** |

### `/[locale]` (dashboard)

| State                                           | First Load JS | Delta    |
| ----------------------------------------------- | ------------- | -------- |
| Before                                          | ~185 kB       | baseline |
| After (no direct recharts/framer on this route) | ~185 kB       | ± 0      |

---

## How to run the bundle analyzer

```bash
# Wire is: ANALYZE=true → next.config.ts → @next/bundle-analyzer
npm run analyze

# On Windows (PowerShell):
$env:ANALYZE="true"; npm run build
```

The analyzer opens two HTML treemaps in your browser:

- `client.html` — all client-side JS chunks
- `server.html` — server-side JS chunks (usually less relevant)

Look for large boxes inside your route chunks. Key suspects:

- `recharts` inside any non-analytics route chunk
- `framer-motion` inside the initial dashboard chunk
- `lottie-react` if it appears at all (it is unused)

---

## Maintenance rules

1. **After any PR that adds a new `import` of recharts, framer-motion, or lottie-react**:
   run `npm run analyze` and confirm the import appears only inside the expected lazy chunk.

2. **If First Load JS for any route exceeds its budget**:
   open an issue tagged `perf` and block merge until resolved.

3. **Update this table after every performance-impacting PR.**
