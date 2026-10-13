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
    <section className="panel period-highlights" aria-label="Highlight Periode">
      <div className="executive-heading">
        <h2>Highlight Periode</h2>
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
          <dt>Pertumbuhan ringkasan</dt>
          <dd>
            <strong>
              {metrics.revenueGrowth === null
                ? "Belum tersedia"
                : `${metrics.revenueGrowth > 0 ? "+" : ""}${formatPercentage(metrics.revenueGrowth)}`}
            </strong>
            <span>vs {metrics.period.days} hari sebelumnya</span>
          </dd>
        </div>
      </dl>
      <p className="executive-footnote">
        Batas minggu/bulan dapat berisi periode parsial. Nilai sama memilih
        periode paling awal; tanpa transaksi tercatat bernilai nol.
      </p>
    </section>
  );
}
