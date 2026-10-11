import { z } from "zod";
import type { UploadedData } from "@/lib/types";
import { calculateProducts, calculateTotals } from "@/lib/analytics";
import {
  dateMs,
  DAY_MS,
  formatDate,
  formatNumber,
  formatPercentage,
  formatRupiah,
  isoDay,
} from "@/lib/utils";

export const goalSchema = z
  .object({
    id: z.string().min(1).max(100),
    metric: z.enum(["revenue", "orders", "units", "grossProfit", "netProfit"]),
    period: z.enum(["daily", "monthly", "yearly"]),
    target: z.number().finite().positive().max(1e15),
    createdAt: z.iso.datetime(),
    enabled: z.boolean(),
  })
  .strict()
  .refine(
    (g) =>
      !["orders", "units"].includes(g.metric) || Number.isInteger(g.target),
    "Target penjualan harus bilangan bulat.",
  );
export type BusinessGoal = z.infer<typeof goalSchema>;
export const GOALS_KEY = "ramu.businessGoals.v1";
const storedGoalsSchema = z
  .object({ version: z.literal(1), goals: z.array(goalSchema).max(100) })
  .strict();
export function parseStoredGoals(raw: string | null): BusinessGoal[] {
  try {
    const parsed = storedGoalsSchema.safeParse(JSON.parse(raw ?? "null"));
    return parsed.success
      ? parsed.data.goals.filter(
          (g, i, a) => a.findIndex((x) => x.id === g.id) === i,
        )
      : [];
  } catch {
    return [];
  }
}
export function serializeGoals(goals: BusinessGoal[]) {
  return JSON.stringify(storedGoalsSchema.parse({ version: 1, goals }));
}
export function parseGoalTarget(value: string): number {
  const s = value.trim().replace(/^Rp\s*/i, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))
    throw new Error("Gunakan angka, misalnya 100000000 atau Rp100.000.000.");
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 1e15)
    throw new Error(
      "Nilai target harus lebih dari nol dan paling besar Rp1.000 triliun.",
    );
  return n;
}
export const metricLabels: Record<BusinessGoal["metric"], string> = {
  revenue: "Pendapatan",
  orders: "Pesanan",
  units: "Unit Terjual",
  grossProfit: "Laba Kotor",
  netProfit: "Laba Bersih",
};
export const periodLabels: Record<BusinessGoal["period"], string> = {
  daily: "Harian",
  monthly: "Bulanan",
  yearly: "Tahunan",
};
export const formatGoalValue = (metric: BusinessGoal["metric"], n: number) =>
  ["orders", "units"].includes(metric) ? formatNumber(n) : formatRupiah(n);
export const todayInJakarta = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function periodBounds(date: string, period: BusinessGoal["period"]) {
  const d = new Date(dateMs(date)),
    y = d.getUTCFullYear(),
    m = d.getUTCMonth();
  const start =
    period === "daily"
      ? date
      : isoDay(Date.UTC(y, period === "yearly" ? 0 : m, 1));
  const end =
    period === "daily"
      ? date
      : isoDay(Date.UTC(y, period === "yearly" ? 12 : m + 1, 0));
  return { start, end };
}
export interface GoalProgress {
  goal: BusinessGoal;
  target: number;
  actual: number | null;
  progressPercentage: number | null;
  remaining: number | null;
  expectedProgressToDate: number;
  paceStatus: "ahead" | "on-track" | "behind" | "completed" | null;
  requiredRemainingPace: number | null;
  periodStart: string;
  periodEnd: string;
  referenceDate: string;
  latestDataDate: string | null;
  daysElapsed: number;
  daysRemaining: number;
  missing: string | null;
  supportingProducts: { name: string; revenue: number; contribution: number }[];
}
export function calculateGoal(
  goal: BusinessGoal,
  data: UploadedData | null,
  today = todayInJakarta(),
): GoalProgress {
  goalSchema.parse(goal);
  const dates = data?.transactions.map((t) => t.date).sort() ?? [],
    latest = dates.at(-1) ?? null;
  const current = periodBounds(today, goal.period);
  const includesCurrent = dates.some(
    (d) => d >= current.start && d <= current.end,
  );
  const referenceDate = includesCurrent || !latest ? today : latest;
  const bounds = periodBounds(referenceDate, goal.period);
  const totalDays =
    Math.round((dateMs(bounds.end) - dateMs(bounds.start)) / DAY_MS) + 1;
  const daysElapsed =
    Math.round((dateMs(referenceDate) - dateMs(bounds.start)) / DAY_MS) + 1;
  const daysRemaining = totalDays - daysElapsed;
  const rows =
    data?.transactions.filter(
      (t) => t.date >= bounds.start && t.date <= referenceDate,
    ) ?? [];
  const totals = calculateTotals(rows, data?.products ?? []);
  let missing: string | null = !data
    ? "Tambahkan data bisnis untuk melihat kemajuan target."
    : null;
  if (
    data &&
    goal.metric === "orders" &&
    !rows.every((t) => Boolean(t.orderId))
  )
    missing = "Data nomor pesanan belum tersedia untuk seluruh penjualan.";
  if (data && goal.metric === "units" && !rows.every((t) => t.quantity > 0))
    missing = "Data jumlah unit belum tersedia untuk seluruh penjualan.";
  if (
    data &&
    ["grossProfit", "netProfit"].includes(goal.metric) &&
    totals.cogs === null
  )
    missing =
      "Data biaya produk belum tersedia lengkap. Tambahkan biaya per unit dan jumlah unit.";
  const coveredExpenses = Boolean(
    data?.expenseCoverage &&
      data.expenseCoverage.start <= bounds.start &&
      data.expenseCoverage.end >= referenceDate,
  );
  if (data && goal.metric === "netProfit" && !coveredExpenses)
    missing =
      "Laba bersih membutuhkan biaya produk lengkap dan biaya operasional yang dikonfirmasi lengkap untuk periode ini.";
  const expenseTotal =
    data?.expenses
      .filter((e) => e.date >= bounds.start && e.date <= referenceDate)
      .reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const actual = missing
    ? null
    : goal.metric === "netProfit"
      ? totals.grossProfit! - expenseTotal
      : goal.metric === "grossProfit"
        ? totals.grossProfit
        : totals[goal.metric];
  const progressPercentage =
    actual === null ? null : (actual / goal.target) * 100;
  const remaining = actual === null ? null : Math.max(0, goal.target - actual);
  const expectedProgressToDate = (daysElapsed / totalDays) * 100;
  const paceStatus =
    progressPercentage === null
      ? null
      : progressPercentage >= 100
        ? "completed"
        : progressPercentage > expectedProgressToDate + 5
          ? "ahead"
          : progressPercentage < expectedProgressToDate - 5
            ? "behind"
            : "on-track";
  const requiredRemainingPace =
    remaining === null
      ? null
      : remaining === 0
        ? 0
        : daysRemaining > 0
          ? remaining / daysRemaining
          : null;
  return {
    goal,
    target: goal.target,
    actual,
    progressPercentage,
    remaining,
    expectedProgressToDate,
    paceStatus,
    requiredRemainingPace,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    referenceDate,
    latestDataDate: latest,
    daysElapsed,
    daysRemaining,
    missing,
    supportingProducts: rows.every((t) => Boolean(t.productName))
      ? calculateProducts(rows, data?.products ?? [])
          .slice(0, 3)
          .map((p) => ({
            name: p.name,
            revenue: p.revenue,
            contribution: p.contribution,
          }))
      : [],
  };
}
export const statusLabels = {
  ahead: "Di atas target",
  "on-track": "Sesuai jalur",
  behind: "Perlu dikejar",
  completed: "Tercapai",
};
export function goalInsight(p: GoalProgress) {
  const title = `${metricLabels[p.goal.metric]} ${periodLabels[p.goal.period].toLowerCase()}`;
  if (p.missing) return `${title}: ${p.missing}`;
  return `${title} mencapai ${formatPercentage(p.progressPercentage!)} (${formatGoalValue(p.goal.metric, p.actual!)} dari ${formatGoalValue(p.goal.metric, p.target)}). ${statusLabels[p.paceStatus!]}; ${formatPercentage(p.expectedProgressToDate)} periode sudah berjalan. Sisa ${formatGoalValue(p.goal.metric, p.remaining!)}. ${p.daysRemaining} hari tersisa. ${p.requiredRemainingPace === null ? "Periode sudah selesai; tidak ada hari tersisa untuk mengejar target." : `Rata-rata yang dibutuhkan ${formatGoalValue(p.goal.metric, p.requiredRemainingPace)} per hari selama sisa periode.`}`;
}
export function goalIntent(question: string) {
  const q = question.toLowerCase();
  if (/prediksi|forecast|besok|bulan depan|tahun depan/.test(q)) return null;
  if (
    !/target|tujuan|goal/.test(q) &&
    !/penjualan per hari.*dibutuhkan/.test(q)
  )
    return null;
  if (/produk/.test(q)) return "goal_supporting_products" as const;
  if (/berapa lagi|sisa|kurang|dibutuhkan/.test(q) && !/per hari/.test(q))
    return "goal_remaining" as const;
  if (/per hari|kejar|pace/.test(q)) return "goal_pace" as const;
  if (/sesuai|jalur|status/.test(q)) return "goal_status" as const;
  return "goal_progress" as const;
}
export function answerGoalQuestion(question: string, progress: GoalProgress[]) {
  let selected = progress.filter((p) => p.goal.enabled);
  if (/tahunan|tahun ini/.test(question.toLowerCase()))
    selected = selected.filter((p) => p.goal.period === "yearly");
  else if (/bulan/.test(question.toLowerCase()))
    selected = selected.filter((p) => p.goal.period === "monthly");
  else if (/harian|hari ini/.test(question.toLowerCase()))
    selected = selected.filter((p) => p.goal.period === "daily");
  if (/pendapatan|omzet/.test(question.toLowerCase()))
    selected = selected.filter((p) => p.goal.metric === "revenue");
  else if (/pesanan/.test(question.toLowerCase()))
    selected = selected.filter((p) => p.goal.metric === "orders");
  else if (/unit/.test(question.toLowerCase()))
    selected = selected.filter((p) => p.goal.metric === "units");
  else if (/laba bersih/.test(question.toLowerCase()))
    selected = selected.filter((p) => p.goal.metric === "netProfit");
  else if (/laba kotor/.test(question.toLowerCase()))
    selected = selected.filter((p) => p.goal.metric === "grossProfit");
  if (!selected.length)
    return "Belum ada target aktif yang sesuai. Buat Target Bisnis terlebih dahulu agar RAMU dapat membantu memantau kemajuannya.";
  return selected
    .slice(0, 8)
    .map(
      (p) =>
        `${goalInsight(p)}\nProgress dihitung berdasarkan data terakhir: ${p.latestDataDate ? formatDate(p.latestDataDate) : "belum tersedia"}; tanggal acuan ${formatDate(p.referenceDate)}.${goalIntent(question) === "goal_supporting_products" ? (p.supportingProducts.length ? ` ${p.supportingProducts.map((x) => `${x.name} menyumbang ${formatPercentage(x.contribution)} pendapatan periode target`).join("; ")}. Kontribusi pendapatan tidak sama dengan kontribusi laba atau jumlah pesanan.` : " Data produk belum tersedia.") : ""}`,
    )
    .join("\n\n");
}
