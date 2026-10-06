import type {
  BusinessMetrics,
  Product,
  ProductMetrics,
  Totals,
  Transaction,
  TrendPoint,
  UploadedData,
} from "@/lib/types";
import { DAY_MS, dateMs, isoDay, normalizeName } from "@/lib/utils";

export const transactionRevenue = (transaction: Transaction) =>
  transaction.revenue ??
  transaction.quantity * transaction.unitPrice - transaction.discount;
export const growth = (current: number, previous: number): number | null =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;

export function getMonthlyRevenueGrowth(transactions: Transaction[]) {
  if (!transactions.length) return null;
  const dates = transactions.map((t) => t.date).sort();
  const first = dates[0],
    last = dates.at(-1)!;
  const end = new Date(dateMs(last));
  // An incomplete latest calendar month is excluded from monthly comparisons.
  const year = end.getUTCFullYear();
  let month = end.getUTCMonth();
  if (end.getUTCDate() !== new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
    month--;
  const currentStart = isoDay(Date.UTC(year, month, 1)),
    currentEnd = isoDay(Date.UTC(year, month + 1, 0));
  const previousStart = isoDay(Date.UTC(year, month - 1, 1)),
    previousEnd = isoDay(Date.UTC(year, month, 0));
  if (first > previousStart) return null;
  const revenue = (start: string, end: string) =>
    transactions
      .filter((t) => t.date >= start && t.date <= end)
      .reduce((sum, t) => sum + transactionRevenue(t), 0);
  const currentRevenue = revenue(currentStart, currentEnd),
    previousRevenue = revenue(previousStart, previousEnd);
  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    currentRevenue,
    previousRevenue,
    growth: growth(currentRevenue, previousRevenue),
  };
}

function productLookup(products: Product[]) {
  const byId = new Map(products.filter((p) => p.id).map((p) => [p.id!, p]));
  const byName = new Map(products.map((p) => [normalizeName(p.name), p]));
  return (t: Transaction) =>
    (t.productId ? byId.get(t.productId) : undefined) ??
    byName.get(normalizeName(t.productName));
}

export function calculateTotals(
  transactions: Transaction[],
  products: Product[],
): Totals {
  const lookup = productLookup(products);
  let revenue = 0,
    units = 0,
    knownUnits = 0,
    knownCogs = 0;
  const orders = new Set<string>();
  for (const t of transactions) {
    revenue += transactionRevenue(t);
    units += t.quantity;
    orders.add(t.orderId);
    const cogs = lookup(t)?.cogs;
    if (cogs !== undefined) {
      knownCogs += t.quantity * cogs;
      knownUnits += t.quantity;
    }
  }
  const complete = transactions.length > 0 && knownUnits === units;
  const cogs = complete ? knownCogs : null;
  const grossProfit = cogs === null ? null : revenue - cogs;
  return {
    revenue,
    orders: orders.size,
    units,
    aov: orders.size ? revenue / orders.size : 0,
    cogs,
    grossProfit,
    grossMargin:
      grossProfit !== null && revenue > 0
        ? (grossProfit / revenue) * 100
        : null,
    cogsCoverage: units ? (knownUnits / units) * 100 : 0,
  };
}

export function calculateProducts(
  transactions: Transaction[],
  products: Product[],
  previous: Transaction[] | null = null,
): ProductMetrics[] {
  const lookup = productLookup(products);
  const groups = new Map<
    string,
    { name: string; transactions: Transaction[] }
  >();
  const key = (t: Transaction) => {
    const matched = lookup(t);
    return matched?.id
      ? `id:${matched.id}`
      : `name:${normalizeName(matched?.name ?? t.productName)}`;
  };
  for (const t of transactions) {
    const id = key(t);
    const group = groups.get(id) ?? {
      name: lookup(t)?.name ?? t.productName,
      transactions: [],
    };
    group.transactions.push(t);
    groups.set(id, group);
  }
  const previousRevenue = new Map<string, number>();
  previous?.forEach((t) =>
    previousRevenue.set(
      key(t),
      (previousRevenue.get(key(t)) ?? 0) + transactionRevenue(t),
    ),
  );
  const totalRevenue = transactions.reduce(
    (sum, t) => sum + transactionRevenue(t),
    0,
  );
  return [...groups.entries()]
    .map(([id, group]) => {
      const totals = calculateTotals(group.transactions, products);
      return {
        name: group.name,
        revenue: totals.revenue,
        units: totals.units,
        cogs: totals.cogs,
        grossProfit: totals.grossProfit,
        margin: totals.grossMargin,
        contribution: totalRevenue ? (totals.revenue / totalRevenue) * 100 : 0,
        growth: previous
          ? growth(totals.revenue, previousRevenue.get(id) ?? 0)
          : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function aggregateTrends(
  transactions: Transaction[],
  start: string,
  end: string,
  unit: "day" | "week" | "month",
): TrendPoint[] {
  const bucket = (date: string) => {
    if (unit === "month") return `${date.slice(0, 7)}-01`;
    if (unit === "week") {
      const time = dateMs(date),
        weekday = new Date(time).getUTCDay();
      return isoDay(time - ((weekday + 6) % 7) * DAY_MS);
    }
    return date;
  };
  const points = new Map<string, number>();
  for (let time = dateMs(start); time <= dateMs(end); time += DAY_MS)
    points.set(bucket(isoDay(time)), 0);
  for (const t of transactions) {
    const key = bucket(t.date);
    if (points.has(key))
      points.set(key, points.get(key)! + transactionRevenue(t));
  }
  return [...points]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
}

export function analyzeBusiness(data: UploadedData): BusinessMetrics | null {
  if (!data.transactions.length) return null;
  const dates = data.transactions.map((t) => t.date).sort();
  const start = dates[0],
    end = dates.at(-1)!;
  const span = Math.round((dateMs(end) - dateMs(start)) / DAY_MS) + 1;
  // Use equal adjacent windows; one-day datasets have no comparison.
  const days = span >= 60 ? 30 : span >= 2 ? Math.floor(span / 2) : 1;
  const currentStart = isoDay(dateMs(end) - (days - 1) * DAY_MS);
  const previousEnd = span >= 2 ? isoDay(dateMs(currentStart) - DAY_MS) : null;
  const previousStart = previousEnd
    ? isoDay(dateMs(previousEnd) - (days - 1) * DAY_MS)
    : null;
  const current = data.transactions.filter(
    (t) => t.date >= currentStart && t.date <= end,
  );
  const previousRows =
    previousStart && previousEnd
      ? data.transactions.filter(
          (t) => t.date >= previousStart && t.date <= previousEnd,
        )
      : null;
  const totals = calculateTotals(current, data.products);
  const previous = previousRows
    ? calculateTotals(previousRows, data.products)
    : null;
  const channelMap = new Map<string, number>();
  current.forEach((t) => {
    const channel = t.channel || "Tanpa kanal";
    channelMap.set(
      channel,
      (channelMap.get(channel) ?? 0) + transactionRevenue(t),
    );
  });
  return {
    ...totals,
    period: { start: currentStart, end, days, previousStart, previousEnd },
    dataPeriod: { start, end },
    previous,
    revenueGrowth: previous ? growth(totals.revenue, previous.revenue) : null,
    profitGrowth:
      previous?.grossProfit !== null &&
      previous?.grossProfit !== undefined &&
      totals.grossProfit !== null
        ? growth(totals.grossProfit, previous.grossProfit)
        : null,
    orderGrowth: previous ? growth(totals.orders, previous.orders) : null,
    aovGrowth: previous ? growth(totals.aov, previous.aov) : null,
    products: calculateProducts(current, data.products, previousRows),
    trends: {
      day: aggregateTrends(data.transactions, start, end, "day"),
      week: aggregateTrends(data.transactions, start, end, "week"),
      month: aggregateTrends(data.transactions, start, end, "month"),
    },
    expenses: data.expenses
      .filter((e) => e.date >= currentStart && e.date <= end)
      .reduce((sum, e) => sum + e.amount, 0),
    channels: [...channelMap]
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export const getBusinessOverview = (m: BusinessMetrics) => ({
  revenue: m.revenue,
  orders: m.orders,
  units: m.units,
  aov: m.aov,
  grossProfit: m.grossProfit,
  grossMargin: m.grossMargin,
  revenueGrowth: m.revenueGrowth,
  cogsCoverage: m.cogsCoverage,
  period: m.period,
});
export const getTopSellingProduct = (m: BusinessMetrics) =>
  [...m.products].sort((a, b) => b.units - a.units)[0] ?? null;
export const getMostProfitableProduct = (m: BusinessMetrics) =>
  m.products
    .filter((p) => p.grossProfit !== null)
    .sort((a, b) => b.grossProfit! - a.grossProfit!)[0] ?? null;
export const getHighestMarginProduct = (m: BusinessMetrics) =>
  m.products
    .filter((p) => p.margin !== null)
    .sort((a, b) => b.margin! - a.margin!)[0] ?? null;
export const getRevenueGrowth = (m: BusinessMetrics) => ({
  growth: m.revenueGrowth,
  period: m.period,
});
export const getProductPerformance = (m: BusinessMetrics) => m.products;
