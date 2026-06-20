"use client";

import { RefreshCcw, TriangleAlert } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function QueryError({
  message = "Something went wrong. Please try again.",
  onRetry,
  className,
}: QueryErrorProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-5 dark:border-rose-900/60 dark:bg-rose-950/20",
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
        aria-hidden="true"
      >
        <TriangleAlert className="h-5 w-5" />
      </div>
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-rose-800 dark:text-rose-300">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
