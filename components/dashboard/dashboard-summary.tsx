import {
  CircleDollarSign,
  Receipt,
  ShoppingBag,
  Wallet,
  Package,
} from "lucide-react";
import { KpiCard } from "./kpi-card";
import type { BusinessMetrics } from "@/lib/types";
import { formatRupiah, formatNumber } from "@/lib/utils";
export function DashboardSummary({ metrics: m }: { metrics: BusinessMetrics }) {
  return (
    <section className="executive-summary" aria-label="Ringkasan bisnis">
      <div className="period-row">
        <span>Ringkasan {m.period.days} hari terakhir dalam data</span>
        <span>Dibanding periode sebelumnya dengan durasi sama</span>
      </div>
      <div className="kpi-grid">
        <KpiCard
          label="Pendapatan"
          value={formatRupiah(m.revenue)}
          growth={m.revenueGrowth}
          days={m.period.days}
          icon={Wallet}
        />
        <KpiCard
          label="Laba Kotor"
          unavailable={m.grossProfit === null}
          value={
            m.grossProfit === null
              ? "Belum tersedia"
              : formatRupiah(m.grossProfit)
          }
          growth={m.profitGrowth}
          days={m.period.days}
          icon={CircleDollarSign}
          note={
            m.grossProfit === null
              ? "Lengkapi jumlah terjual dan biaya produk"
              : undefined
          }
        />
        <KpiCard
          label="Pesanan"
          unavailable={!m.capabilities.orders}
          value={
            m.capabilities.orders ? formatNumber(m.orders) : "Belum tersedia"
          }
          growth={m.orderGrowth}
          days={m.period.days}
          icon={ShoppingBag}
          note={!m.capabilities.orders ? "Tambahkan nomor pesanan" : undefined}
        />
        <KpiCard
          label="Rata-rata Nilai Transaksi"
          unavailable={!m.capabilities.orders}
          value={m.capabilities.orders ? formatRupiah(m.aov) : "Belum tersedia"}
          growth={m.aovGrowth}
          days={m.period.days}
          icon={Receipt}
          note={!m.capabilities.orders ? "Tambahkan nomor pesanan" : undefined}
        />
        <KpiCard
          label="Unit Terjual"
          unavailable={!m.capabilities.units}
          value={
            m.capabilities.units ? formatNumber(m.units) : "Belum tersedia"
          }
          growth={null}
          days={m.period.days}
          icon={Package}
          note={
            !m.capabilities.units
              ? "Tambahkan jumlah unit"
              : `Dalam ${m.period.days} hari ringkasan`
          }
        />
      </div>
    </section>
  );
}
