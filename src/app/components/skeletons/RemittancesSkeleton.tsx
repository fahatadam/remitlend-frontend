"use client";

import { Skeleton } from "../ui/Skeleton";

/**
 * Skeleton for the remittances table.
 * Matches the 12-column grid: recipient (4) | amount (2) | currency (2) | date (2) | status (2)
 */
export function RemittancesSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading remittances"
      className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-950"
    >
      {/* Table header */}
      <div className="grid grid-cols-12 gap-4 border-b border-zinc-100 bg-zinc-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <Skeleton className="col-span-4 h-3 w-20" />
        <Skeleton className="col-span-2 h-3 w-14" />
        <Skeleton className="col-span-2 h-3 w-16" />
        <Skeleton className="col-span-2 h-3 w-12" />
        <Skeleton className="col-span-2 h-3 w-14" />
      </div>

      {/* Table rows */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-4 px-6 py-4">
            {/* Recipient */}
            <div className="col-span-4 flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className="h-4 w-32" />
            </div>
            {/* Amount */}
            <div className="col-span-2">
              <Skeleton className="h-4 w-20" />
            </div>
            {/* Currency */}
            <div className="col-span-2">
              <Skeleton className="h-4 w-16" />
            </div>
            {/* Date */}
            <div className="col-span-2">
              <Skeleton className="h-4 w-20" />
            </div>
            {/* Status badge */}
            <div className="col-span-2">
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
