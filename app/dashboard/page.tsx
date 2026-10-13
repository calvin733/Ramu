"use client";
import { useState } from "react";
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
  return (
    <>
      <DashboardSummary metrics={metrics} />
      <div
        className={`executive-grid ${hasChannels ? "" : "without-channels"} ${metrics.capabilities.products ? "" : "without-products"}`}
      >
        <RevenueChart metrics={metrics} unit={unit} onUnitChange={setUnit} />
        <BusinessPulse
          metrics={metrics}
          insights={insights}
          goals={goalProgress}
        />
        <ChannelPerformance metrics={metrics} />
        {metrics.capabilities.products && <ProductPreview metrics={metrics} />}
        <PeriodHighlights metrics={metrics} unit={unit} />
        <InsightSection metrics={metrics} insights={insights} />
        <DashboardGoals />
      </div>
    </>
  );
}
export default function Dashboard() {
  const { data, metrics, insights } = useBusiness();
  return (
    <div className="page dashboard-page">
      <div className="page-heading dashboard-intro">
        <div>
          <h1>Dashboard</h1>
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
