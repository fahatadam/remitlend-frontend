"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { QueryErrorBoundary } from "../../components/global_ui/ErrorBoundary";
import { useWalletStore, selectWalletAddress } from "../../stores/useWalletStore";
import { AnalyticsSkeleton } from "../../components/skeletons/AnalyticsSkeleton";

// Dynamically imported so recharts (and all chart dependencies) are NOT included
// in the initial analytics route JS bundle. They are fetched only when the user
// navigates to /analytics.
const FinancialPerformanceDashboard = dynamic(
  () =>
    import("../../components/dashboards/FinancialPerformanceDashboard").then(
      (m) => m.FinancialPerformanceDashboard,
    ),
  { ssr: false, loading: () => <AnalyticsSkeleton /> },
);

type ViewType = "borrower" | "lender";

export default function AnalyticsPage() {
  const [view, setView] = useState<ViewType>("borrower");
  const address = useWalletStore(selectWalletAddress);
  const userId = address ?? "demo_user";

  return (
    <main className="min-h-screen p-8 lg:p-12 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Analytics Dashboard</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Visualize your financial performance with interactive charts
        </p>
      </header>

      <div className="flex gap-2" role="group" aria-label="Analytics view selector">
        {(["borrower", "lender"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-5 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
              view === v
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
            aria-pressed={view === v}
          >
            {v}
          </button>
        ))}
      </div>

      <QueryErrorBoundary scope="analytics dashboard" variant="section">
        <FinancialPerformanceDashboard
          userId={userId}
          userType={view}
          walletAddress={address ?? undefined}
        />
      </QueryErrorBoundary>
    </main>
  );
}
