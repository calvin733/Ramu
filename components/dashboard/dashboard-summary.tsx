import { CircleDollarSign, Receipt, ShoppingBag, Wallet } from "lucide-react";
import { KpiCard } from "./kpi-card";
import type { BusinessMetrics } from "@/lib/types";
import {
  formatDate,
  formatPercentage,
  formatRupiah,
  formatNumber,
} from "@/lib/utils";
export function DashboardSummary({ metrics: m }: { metrics: BusinessMetrics }) {
  return (
    <section className="executive-summary" aria-label="Ringkasan bisnis">
      <div className="period-row">
        <span>
          Ringkasan {formatDate(m.period.start)}–{formatDate(m.period.end)}
        </span>
        <span>
          {m.revenueGrowth === null
            ? "Perbandingan penjualan yang setara belum tersedia"
            : `Dibanding ${m.period.days} hari sebelumnya`}
        </span>
      </div>
      <div className="kpi-grid">
        <KpiCard
          label="Penjualan"
          value={formatRupiah(m.revenue)}
          growth={null}
          note="Penjualan tercatat, bukan dana diterima"
          days={m.period.days}
          icon={Wallet}
        />
        {m.revenueGrowth !== null && (
          <KpiCard
            label="Perubahan Penjualan"
            value={`${m.revenueGrowth > 0 ? "+" : ""}${formatPercentage(m.revenueGrowth)}`}
            growth={null}
            note={`vs ${m.period.days} hari sebelumnya`}
            days={m.period.days}
            icon={Receipt}
          />
        )}
        {m.capabilities.orders && (
          <KpiCard
            label="Pesanan"
            value={formatNumber(m.orders)}
            growth={m.orderGrowth}
            days={m.period.days}
            icon={ShoppingBag}
          />
        )}
        {m.grossProfit !== null && (
          <KpiCard
            label="Laba Kotor"
            value={formatRupiah(m.grossProfit)}
            growth={m.profitGrowth}
            days={m.period.days}
            icon={CircleDollarSign}
            note="Sebelum biaya operasional dan pajak"
          />
        )}
      </div>
      {(m.capabilities.orders ||
        m.capabilities.units ||
        m.grossMargin !== null) && (
        <details className="summary-more">
          <summary>Angka lainnya</summary>
          <dl>
            {m.capabilities.orders && (
              <div>
                <dt>Rata-rata nilai transaksi</dt>
                <dd>{formatRupiah(m.aov)}</dd>
              </div>
            )}
            {m.capabilities.units && (
              <div>
                <dt>Unit terjual</dt>
                <dd>{formatNumber(m.units)}</dd>
              </div>
            )}
            {m.grossMargin !== null && (
              <div>
                <dt>Margin kotor</dt>
                <dd>{formatPercentage(m.grossMargin)}</dd>
              </div>
            )}
          </dl>
        </details>
      )}
    </section>
  );
}
