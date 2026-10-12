"use client";
import Link from "next/link";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ProductPreview } from "@/components/dashboard/product-preview";
import { InsightSection } from "@/components/dashboard/insight-section";
import { DashboardGoals } from "@/components/goals/dashboard-goals";
import { formatDate } from "@/lib/utils";

export default function Dashboard() {
  const { data, metrics, insights } = useBusiness();
  return (
    <div className="page dashboard-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">GAMBARAN BISNIS ANDA</span>
          <h1>
            Dashboard<span className="title-dot">.</span>
          </h1>
          <p>Ringkasan kondisi bisnis Anda.</p>
          {metrics && (
            <span className="data-through">
              Data sampai {formatDate(metrics.dataPeriod.end)}
            </span>
          )}
        </div>
        <Button variant="ghost" asChild>
          <Link href="/data">Kelola Data</Link>
        </Button>
      </div>
      {!metrics || !data ? (
        <EmptyState />
      ) : (
        <>
          <DashboardSummary metrics={metrics} />
          <RevenueChart metrics={metrics} key={data.source.loadedAt} />
          <InsightSection
            metrics={metrics}
            insights={insights}
            key={`insights-${data.source.loadedAt}`}
          />
          <DashboardGoals />
          {metrics.capabilities.products ? (
            <ProductPreview
              products={metrics.products}
              key={`products-${data.source.loadedAt}`}
            />
          ) : (
            <section className="panel capability-note">
              <h2>Analisis produk belum tersedia</h2>
              <p>Tambahkan nama produk untuk melihat kinerja produk.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
