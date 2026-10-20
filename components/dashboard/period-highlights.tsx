import type { BusinessMetrics } from "@/lib/types";
import { trendExtremes, type TrendUnit } from "@/lib/queries/aggregates";
import { formatDate, formatRupiah } from "@/lib/utils";
import { completeTrendPeriods } from "@/lib/dashboard/periods";
export function PeriodHighlights({
  metrics,
  unit,
}: {
  metrics: BusinessMetrics;
  unit: TrendUnit;
}) {
  const { complete, partialCount } = completeTrendPeriods(metrics, unit);
  const extremes = complete.length >= 2 ? trendExtremes(complete) : null;
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
        <p>
          {unit === "day"
            ? "Hari dalam rentang grafik"
            : "Hanya periode kalender lengkap"}
        </p>
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
        {!extremes && complete.length === 1 && (
          <div>
            <dt>{period} tercatat</dt>
            <dd>
              <strong>{date(complete[0].date)}</strong>
              <span>{formatRupiah(complete[0].revenue)}</span>
            </dd>
          </div>
        )}
      </dl>
      {!complete.length && (
        <p>
          Belum ada {period.toLowerCase()} penuh untuk dibandingkan. Lihat
          transaksi yang tercatat pada grafik.
        </p>
      )}
      <p className="executive-footnote">
        {partialCount > 0
          ? "Periode awal atau akhir yang belum lengkap tetap tampil di grafik, tetapi tidak diranking di sini. "
          : ""}
        Periode tanpa transaksi tercatat ditampilkan Rp0.
      </p>
    </section>
  );
}
