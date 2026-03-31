"use client";

import dynamic from "next/dynamic";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  HandCoins,
  Percent,
  PiggyBank,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ErrorBoundary } from "../../components/global_ui/ErrorBoundary";
import { Skeleton, SkeletonChart } from "../../components/ui/Skeleton";
import {
  useDepositorPortfolio,
  useInvalidatePoolStats,
  useLoans,
  usePoolStats,
  useYieldHistory,
} from "../../hooks/useApi";
import { LoanStatusBadge } from "../../components/ui/LoanStatusBadge";
import { DepositWithdrawSkeleton } from "../../components/skeletons/DepositWithdrawSkeleton";
import { OperationProgress } from "../../components/ui/OperationProgress";
import { useDepositOperation, useWithdrawalOperation } from "../../hooks/useRepaymentOperation";
import { selectWalletAddress, useWalletStore } from "../../stores/useWalletStore";
import { useSSE } from "../../hooks/useSSE";

const YieldEarningsChart = dynamic(
  () => import("../../components/charts/YieldEarningsChart").then((m) => m.YieldEarningsChart),
  { ssr: false, loading: () => <SkeletonChart /> },
);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
import type { Metadata } from "next";
import { buildPageMetadata } from "../../lib/metadata";
import { LendPageClient } from "./LendPageClient";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  return buildPageMetadata({
    locale,
    path: "/lend",
    title: "Lender Portfolio | RemitLend",
    description:
      "Monitor pool performance, funded loans, deposits, withdrawals, and expected lender yield.",
  });
}

export default function LendPage() {
  return <LendPageClient />;
}
