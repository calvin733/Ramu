import type { BusinessMetrics } from "@/lib/types";
import type { TrendUnit } from "@/lib/queries/aggregates";
import { dateMs, DAY_MS, isoDay } from "@/lib/utils";
// Presentation filter only: never recompute or prorate bucket revenue.
export function completeTrendPeriods(m: BusinessMetrics, unit: TrendUnit) {
  const points = m.trends[unit];
  const complete = points.filter((p) => {
    const date = new Date(dateMs(p.date));
    const end =
      unit === "month"
        ? isoDay(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
        : unit === "week"
          ? isoDay(dateMs(p.date) + 6 * DAY_MS)
          : p.date;
    return p.date >= m.dataPeriod.start && end <= m.dataPeriod.end;
  });
  return { complete, partialCount: points.length - complete.length };
}
