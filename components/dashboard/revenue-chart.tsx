"use client";
import { useReducedMotion } from "@/components/hooks/use-reduced-motion";
import type { TrendUnit } from "@/lib/queries/aggregates";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BusinessMetrics } from "@/lib/types";
import { formatDate, formatRupiah } from "@/lib/utils";
import { completeTrendPeriods } from "@/lib/dashboard/periods";

export function RevenueChart({
  metrics,
  unit,
  onUnitChange,
}: {
  metrics: BusinessMetrics;
  unit: TrendUnit;
  onUnitChange: (unit: TrendUnit) => void;
}) {
  const reducedMotion = useReducedMotion();
  const points = metrics.trends[unit];
  const shortMoney = (value: number) =>
    value >= 1e6
      ? `Rp${Number((value / 1e6).toFixed(1)).toLocaleString("id-ID")} jt`
      : value >= 1000
        ? `Rp${Number((value / 1000).toFixed(1)).toLocaleString("id-ID")} rb`
        : formatRupiah(value);
  return (
    <section
      className="panel revenue-panel"
      aria-label="Grafik tren pendapatan"
    >
      <div className="panel-heading">
        <div>
          <h2>Tren Pendapatan</h2>
          <p>Perjalanan penjualan di seluruh periode data</p>
        </div>
        <select
          aria-label="Tampilan waktu grafik"
          value={unit}
          onChange={(e) => onUnitChange(e.target.value as TrendUnit)}
        >
          <option value="day">Harian</option>
          <option value="week">Mingguan</option>
          <option value="month">Bulanan</option>
        </select>
      </div>
      <div className="chart-meta">
        <span>
          <i /> Pendapatan
        </span>
        <span>
          {formatDate(metrics.dataPeriod.start)} –{" "}
          {formatDate(metrics.dataPeriod.end)}
        </span>
      </div>
      <div
        className="revenue-chart"
        role="img"
        aria-label={`Pendapatan ${unit === "month" ? "bulanan" : unit === "week" ? "mingguan" : "harian"} dari ${formatDate(metrics.dataPeriod.start)} hingga ${formatDate(metrics.dataPeriod.end)}`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={points}
            margin={{ top: 15, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a846a" stopOpacity={0.19} />
                <stop offset="100%" stopColor="#4a846a" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#e9ede8"
              strokeDasharray="4 5"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={35}
              tickMargin={12}
              tick={{ fontSize: 12, fill: "#879087" }}
              tickFormatter={(date: string) =>
                formatDate(
                  date,
                  unit === "month"
                    ? { day: undefined, year: undefined, month: "short" }
                    : { year: undefined },
                )
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={76}
              tick={{ fontSize: 12, fill: "#879087" }}
              tickFormatter={shortMoney}
            />
            <Tooltip
              labelFormatter={(label) => formatDate(String(label))}
              formatter={(value) => [formatRupiah(Number(value)), "Pendapatan"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e3e8e1",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Pendapatan"
              stroke="#4a846a"
              strokeWidth={2.5}
              fill="url(#revenueFill)"
              activeDot={{ r: 5, strokeWidth: 3, stroke: "white" }}
              isAnimationActive={!reducedMotion}
              animationDuration={400}
              animationEasing="ease-out"
              key={unit}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {completeTrendPeriods(metrics, unit).partialCount > 0 && (
        <p className="executive-footnote">
          {unit === "month" ? "Bulan" : "Minggu"} di batas awal atau akhir data
          belum lengkap. Angkanya belum dapat dibandingkan sebagai periode
          penuh.
        </p>
      )}
      <details className="chart-accessible">
        <summary>Lihat angka pendapatan</summary>
        <div className="accessible-table">
          <table>
            <thead>
              <tr>
                <th>Periode</th>
                <th>Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{formatDate(p.date)}</td>
                  <td>{formatRupiah(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
