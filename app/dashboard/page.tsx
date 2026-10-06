"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Receipt,
  ShoppingBag,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react";
import { useBusiness } from "@/components/business-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ProductTable } from "@/components/dashboard/product-table";
import { InsightSection } from "@/components/dashboard/insight-section";
import { formatDate, formatPercentage, formatRupiah } from "@/lib/utils";

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
          <p>Kenali performa hari ini, temukan peluang esok hari.</p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/data">
            <Upload size={16} />
            Upload Data
          </Link>
        </Button>
      </div>
      {!metrics || !data ? (
        <>
          <EmptyState />
          <div className="welcome-bottom">
            <span>Mulai dari data yang Anda punya.</span>
            <p>
              RAMU mengubah transaksi menjadi gambaran bisnis yang mudah
              dipahami.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="data-banner">
            <div>
              <span className="banner-icon">
                <ShoppingBag size={20} />
              </span>
              <div>
                <strong>
                  {data.source.kind === "demo"
                    ? "Ramu Bakery"
                    : "Ringkasan bisnis Anda"}
                </strong>
                <span>
                  {data.source.kind === "demo"
                    ? "Sedang menjelajahi data demo bisnis bakery"
                    : data.source.name}
                </span>
              </div>
              <span className="source-badge">
                {data.source.kind === "demo" ? "DATA DEMO" : "DATA UNGGAHAN"}
              </span>
            </div>
            <Link href="/data">
              Kelola data
              <ChevronRight size={15} />
            </Link>
          </div>
          <div className="period-row">
            <span>
              <CalendarDays size={15} />
              <strong>
                {formatDate(metrics.period.start)} –{" "}
                {formatDate(metrics.period.end)}
              </strong>
            </span>
            <span>
              {metrics.period.days} hari terakhir dalam data
              {metrics.period.previousStart &&
                ` · pembanding ${formatDate(metrics.period.previousStart)} – ${formatDate(metrics.period.previousEnd!)}`}
            </span>
          </div>
          <div className="kpi-grid">
            <KpiCard
              label="Pendapatan"
              value={formatRupiah(metrics.revenue)}
              growth={metrics.revenueGrowth}
              days={metrics.period.days}
              icon={Wallet}
            />
            <KpiCard
              label="Laba Kotor"
              value={
                metrics.grossProfit === null
                  ? "Data biaya belum tersedia"
                  : formatRupiah(metrics.grossProfit)
              }
              growth={metrics.profitGrowth}
              days={metrics.period.days}
              icon={CircleDollarSign}
              note={
                metrics.grossProfit === null
                  ? `COGS tersedia: ${formatPercentage(metrics.cogsCoverage)} unit`
                  : undefined
              }
            />
            <KpiCard
              label="Pesanan"
              value={metrics.orders.toLocaleString("id-ID")}
              growth={metrics.orderGrowth}
              days={metrics.period.days}
              icon={ShoppingBag}
            />
            <KpiCard
              label="Rata-rata Pesanan"
              value={formatRupiah(metrics.aov)}
              growth={metrics.aovGrowth}
              days={metrics.period.days}
              icon={Receipt}
            />
          </div>
          <div className="dashboard-middle">
            <RevenueChart metrics={metrics} key={data.source.loadedAt} />
            <section className="panel channel-panel">
              <div className="panel-heading">
                <div>
                  <h2>Kanal Penjualan</h2>
                  <p>Di mana pelanggan berbelanja</p>
                </div>
                <ArrowUpRight size={18} className="muted" />
              </div>
              <div className="channel-total">
                <span>Pendapatan periode ini</span>
                <strong>{formatRupiah(metrics.revenue)}</strong>
              </div>
              <div className="channel-stack" aria-hidden="true">
                {metrics.channels.map((c, i) => (
                  <span
                    key={c.name}
                    className={`channel-color-${i % 3}`}
                    style={{
                      width: `${metrics.revenue ? (c.revenue / metrics.revenue) * 100 : 0}%`,
                    }}
                  />
                ))}
              </div>
              <div className="channel-list">
                {metrics.channels.map((c, i) => (
                  <div key={c.name}>
                    <span>
                      <i className={`channel-color-${i % 3}`} />
                      {c.name}
                    </span>
                    <div>
                      <strong>{formatRupiah(c.revenue)}</strong>
                      <span>
                        {formatPercentage(
                          metrics.revenue
                            ? (c.revenue / metrics.revenue) * 100
                            : 0,
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="channel-note">
                Berdasarkan kanal pada data transaksi.
              </div>
            </section>
          </div>
          <InsightSection
            metrics={metrics}
            insights={insights}
            key={`insights-${data.source.loadedAt}`}
          />
          <ProductTable
            products={metrics.products}
            key={`products-${data.source.loadedAt}`}
          />
          <div className="ask-banner">
            <span className="ask-banner-icon">
              <Sparkles size={24} />
            </span>
            <div>
              <h3>Ada angka yang bikin penasaran?</h3>
              <p>
                Tanyakan kepada RAMU. Temukan jawaban dari data bisnis Anda.
              </p>
            </div>
            <Button asChild>
              <Link href="/ask">
                Tanya RAMU
                <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
