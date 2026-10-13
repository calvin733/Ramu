import type { BusinessMetrics, TrendPoint } from "@/lib/types";
import { dateMs, DAY_MS } from "@/lib/utils";
export function channelPerformance(m: BusinessMetrics) {
  if (!m.channels.some((c) => c.name !== "Tanpa kanal")) return [];
  const total = m.channels.reduce((sum, c) => sum + c.revenue, 0);
  return m.channels
    .map((c) => ({
      ...c,
      contribution: total > 0 ? (c.revenue / total) * 100 : null,
    }))
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
}
export type TrendUnit = keyof BusinessMetrics["trends"];
export function defaultTrendUnit(m: BusinessMetrics): TrendUnit {
  const span = (dateMs(m.dataPeriod.end) - dateMs(m.dataPeriod.start)) / DAY_MS;
  return span >= 120 ? "month" : span > 45 ? "week" : "day";
}
export function trendExtremes(points: TrendPoint[]) {
  if (!points.length) return null;
  return points.reduce(
    (result, point) => ({
      best: point.revenue > result.best.revenue ? point : result.best,
      weakest: point.revenue < result.weakest.revenue ? point : result.weakest,
    }),
    { best: points[0], weakest: points[0] },
  );
}
