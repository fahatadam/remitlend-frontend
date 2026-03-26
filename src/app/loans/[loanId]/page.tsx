import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";

export default async function LoanDetailsPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Borrower Portal
        </p>
        <h1 className="mt-3 text-3xl font-bold text-zinc-900 dark:text-zinc-50">Loan #{loanId}</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Track repayment timing, lender terms, and the current outstanding balance for this loan.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Repayment plan</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["Principal remaining", "$1,240"],
              ["Interest accrued", "$74"],
              ["Due date", "April 18, 2026"],
              ["Status", "Current"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
                <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          <div className="rounded-2xl bg-indigo-50 p-5 dark:bg-indigo-500/10">
            <div className="flex items-center gap-3 text-indigo-700 dark:text-indigo-300">
              <Wallet className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Next action</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-indigo-700/80 dark:text-indigo-200">
              Make a repayment before the next due date to keep your score trending upward.
            </p>
            <Link
              href={`/repay/${loanId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Repay this loan
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
