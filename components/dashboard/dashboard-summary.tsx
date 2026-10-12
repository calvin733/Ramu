import { CircleDollarSign, Receipt, ShoppingBag, Wallet } from "lucide-react";
import { KpiCard } from "./kpi-card";
import type { BusinessMetrics } from "@/lib/types";
import { formatPercentage, formatRupiah } from "@/lib/utils";

export function DashboardSummary({ metrics }: { metrics: BusinessMetrics }) {
  return (
    <section aria-label="Ringkasan KPI bisnis">
      <div className="period-row">
        <span>Ringkasan {metrics.period.days} hari terakhir dalam data</span>
        <span>
          Perubahan dibanding periode sebelumnya dengan durasi yang sama.
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
              ? "Data belum tersedia"
              : formatRupiah(metrics.grossProfit)
          }
          growth={metrics.profitGrowth}
          days={metrics.period.days}
          icon={CircleDollarSign}
          note={
            metrics.grossProfit === null
              ? `HPP tersedia: ${formatPercentage(metrics.cogsCoverage)} unit`
              : undefined
          }
        />
        <KpiCard
          label="Pesanan"
          value={
            metrics.capabilities.orders
              ? metrics.orders.toLocaleString("id-ID")
              : "Data belum tersedia"
          }
          growth={metrics.orderGrowth}
          days={metrics.period.days}
          icon={ShoppingBag}
          note={
            !metrics.capabilities.orders ? "Tambahkan nomor pesanan" : undefined
          }
        />
        <KpiCard
          label="Rata-rata Nilai Pesanan"
          value={
            metrics.capabilities.orders
              ? formatRupiah(metrics.aov)
              : "Data belum tersedia"
          }
          growth={metrics.aovGrowth}
          days={metrics.period.days}
          icon={Receipt}
          note={
            !metrics.capabilities.orders ? "Tambahkan nomor pesanan" : undefined
          }
        />
      </div>
    </section>
  );
}
