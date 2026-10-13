import type { BusinessMetrics } from "@/lib/types";
import { trendExtremes, type TrendUnit } from "@/lib/queries/aggregates";
import { formatDate, formatPercentage, formatRupiah } from "@/lib/utils";
export function PeriodHighlights({
  metrics,
  unit,
}: {
  metrics: BusinessMetrics;
  unit: TrendUnit;
}) {
  const extremes = trendExtremes(metrics.trends[unit]);
  const period =
    unit === "month" ? "Bulan" : unit === "week" ? "Minggu" : "Hari";
  const date = (d: string) =>
    formatDate(
      d,
      unit === "month"
        ? { day: undefined, month: "short", year: "numeric" }
        : undefined,
    );
  return (
    <section className="panel period-highlights" aria-label="Sorotan Penjualan">
      <div className="executive-heading">
        <h2>Sorotan Penjualan</h2>
        <p>Seluruh rentang grafik</p>
      </div>
      <dl className="signal-list">
        {extremes && (
          <>
            <div>
              <dt>{period} terbaik</dt>
              <dd>
                <strong>{date(extremes.best.date)}</strong>
                <span>{formatRupiah(extremes.best.revenue)}</span>
              </dd>
            </div>
            <div>
              <dt>{period} terendah</dt>
              <dd>
                <strong>{date(extremes.weakest.date)}</strong>
                <span>{formatRupiah(extremes.weakest.revenue)}</span>
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>Perubahan penjualan</dt>
          <dd>
            <strong>
              {metrics.revenueGrowth === null
                ? "Belum tersedia"
                : `${metrics.revenueGrowth > 0 ? "+" : ""}${formatPercentage(metrics.revenueGrowth)}`}
            </strong>
            <span>dibanding {metrics.period.days} hari sebelumnya</span>
          </dd>
        </div>
      </dl>
      <p className="executive-footnote">
        Awal atau akhir minggu dan bulan bisa belum mencakup seluruh hari.
        Periode tanpa transaksi tercatat ditampilkan Rp0.
      </p>
    </section>
  );
}
