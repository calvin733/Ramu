"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ProductPreview } from "@/components/dashboard/product-preview";
import { InsightSection } from "@/components/dashboard/insight-section";
import { DashboardGoals } from "@/components/goals/dashboard-goals";
import { BusinessPulse } from "@/components/dashboard/business-pulse";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
import { PeriodHighlights } from "@/components/dashboard/period-highlights";
import {
  defaultTrendUnit,
  channelPerformance,
  type TrendUnit,
} from "@/lib/queries/aggregates";
import type { BusinessMetrics, BusinessInsight } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { dashboardDecisions } from "@/lib/dashboard/decisions";
function ExecutiveDashboard({
  metrics,
  insights,
}: {
  metrics: BusinessMetrics;
  insights: BusinessInsight[];
}) {
  const { goalProgress } = useBusiness();
  const [unit, setUnit] = useState<TrendUnit>(() => defaultTrendUnit(metrics));
  const hasChannels = channelPerformance(metrics).length > 0;
  const decisions = dashboardDecisions(metrics, insights, goalProgress);
  return (
    <>
      <DashboardSummary metrics={metrics} />
      <div
        className={`executive-grid decision-grid ${hasChannels ? "" : "without-channels"} ${metrics.capabilities.products ? "" : "without-products"}`}
      >
        <BusinessPulse decision={decisions[0]} />
        <RevenueChart metrics={metrics} unit={unit} onUnitChange={setUnit} />
        <PeriodHighlights metrics={metrics} unit={unit} />
        {metrics.capabilities.products && <ProductPreview metrics={metrics} />}
        <ChannelPerformance metrics={metrics} />
        <InsightSection metrics={metrics} insights={decisions.slice(1)} />
        <DashboardGoals coachedGoalId={decisions[0].goalId} />
      </div>
    </>
  );
}
export default function Dashboard() {
  const { data, metrics, insights } = useBusiness();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (data) heading.current?.focus({ preventScroll: true });
  }, [data]);
  return (
    <div className="page dashboard-page">
      <div className="page-heading dashboard-intro">
        <div>
          <h1 ref={heading} tabIndex={-1}>
            Dashboard
          </h1>
          <p>Ringkasan kondisi bisnis Anda</p>
        </div>
        <div className="dashboard-intro-actions">
          {metrics && (
            <span className="data-through">
              Data sampai {formatDate(metrics.dataPeriod.end)}
            </span>
          )}
          <Button variant="ghost" asChild>
            <Link href="/data">Kelola Data</Link>
          </Button>
        </div>
      </div>
      {data?.source.kind === "upload" && (
        <p className="processed-confirmation" role="status">
          Data berhasil diproses · {data.source.name}
        </p>
      )}
      {!metrics || !data ? (
        <EmptyState />
      ) : (
        <ExecutiveDashboard
          metrics={metrics}
          insights={insights}
          key={data.source.loadedAt}
        />
      )}
    </div>
  );
}
