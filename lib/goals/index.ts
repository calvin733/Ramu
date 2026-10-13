import { z } from "zod";
import { entityLabel } from "@/lib/copy/entity-label";
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
    missing =
      "Lengkapi nomor transaksi agar jumlah pesanan bisa dihitung dengan akurat.";
  if (data && goal.metric === "units" && !rows.every((t) => t.quantity > 0))
    missing =
      "Lengkapi jumlah barang yang terjual agar kemajuan target bisa dihitung dengan akurat.";
  if (
    data &&
    ["grossProfit", "netProfit"].includes(goal.metric) &&
    totals.cogs === null
  )
    missing =
      "Data biaya produk belum lengkap. Tambahkan biaya per unit dan jumlah terjual agar keuntungan bisa dihitung dengan akurat.";
  const coveredExpenses = Boolean(
    data?.expenseCoverage &&
      data.expenseCoverage.start <= bounds.start &&
      data.expenseCoverage.end >= referenceDate,
  );
  if (data && goal.metric === "netProfit" && !coveredExpenses)
    missing =
      "Lengkapi biaya produk dan pastikan seluruh pengeluaran periode ini sudah tercatat agar laba bersih bisa dihitung dengan akurat.";
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
  ahead: "Lebih cepat dari rencana",
  "on-track": "Sesuai jalur",
  behind: "Perlu dikejar",
  completed: "Tercapai",
};
export function goalInsight(p: GoalProgress) {
  const title = `Target ${metricLabels[p.goal.metric].toLowerCase()} ${periodLabels[p.goal.period].toLowerCase()}`;
  if (p.missing) return `${title} belum bisa dipantau. ${p.missing}`;
  const finding =
    p.paceStatus === "completed"
      ? "sudah tercapai"
      : p.paceStatus === "ahead"
        ? "berjalan lebih cepat dari rencana"
        : p.paceStatus === "behind"
          ? "masih tertinggal"
          : "masih sesuai jalur";
  const achievement = `Anda sudah mencapai ${formatPercentage(p.progressPercentage!)} (${formatGoalValue(p.goal.metric, p.actual!)} dari ${formatGoalValue(p.goal.metric, p.target)})${p.paceStatus === "behind" ? `, sementara sekitar ${formatPercentage(p.expectedProgressToDate)} periode sudah berjalan` : ""}.`;
  if (p.paceStatus === "completed")
    return `${title} ${finding}. ${achievement} Pertahankan produk dan channel yang paling banyak menyumbang penjualan.`;
  const next =
    p.daysRemaining === 0
      ? `Periode sudah selesai; sisa ${formatGoalValue(p.goal.metric, p.remaining!)} belum tercapai. Tinjau penjualan periode ini sebelum menyusun target berikutnya.`
      : `Sisa ${formatGoalValue(p.goal.metric, p.remaining!)}; perlu rata-rata ${formatGoalValue(p.goal.metric, p.requiredRemainingPace!)} per hari selama ${p.daysRemaining} hari tersisa.`;
  return `${title} ${finding}. ${achievement} ${next}`;
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
  const intent = goalIntent(question);
  return selected
    .slice(0, 8)
    .map((p) => {
      const scope = `Periode ${formatDate(p.periodStart)}–${formatDate(p.periodEnd)}, dipantau hingga ${formatDate(p.referenceDate)}${p.latestDataDate && p.latestDataDate !== p.referenceDate ? `; data terakhir di file ${formatDate(p.latestDataDate)}` : ""}.`;
      if (
        intent === "goal_supporting_products" &&
        p.supportingProducts.length
      ) {
        const top = p.supportingProducts[0];
        return `${entityLabel(top.name)} paling banyak menyumbang penjualan untuk periode target ${metricLabels[p.goal.metric].toLowerCase()} ${periodLabels[p.goal.period].toLowerCase()}, dengan kontribusi ${formatPercentage(top.contribution)}. ${p.goal.metric === "revenue" ? "Pastikan produk ini tetap tersedia, lalu coba tawarkan bersama produk lain." : "Ini porsi penjualan, bukan porsi laba atau jumlah barang dan pesanan."} ${scope}`;
      }
      if (
        !p.missing &&
        (intent === "goal_remaining" || intent === "goal_pace")
      ) {
        const title = `target ${metricLabels[p.goal.metric].toLowerCase()} ${periodLabels[p.goal.period].toLowerCase()}`;
        if (intent === "goal_pace" && p.remaining! > 0 && p.daysRemaining > 0)
          return `Perlu rata-rata ${formatGoalValue(p.goal.metric, p.requiredRemainingPace!)} per hari selama ${p.daysRemaining} hari tersisa untuk mencapai ${title}. Sisa target ${formatGoalValue(p.goal.metric, p.remaining!)}. ${scope}`;
        const finding =
          p.remaining === 0
            ? `Target ${metricLabels[p.goal.metric].toLowerCase()} ${periodLabels[p.goal.period].toLowerCase()} sudah tercapai.`
            : `Masih perlu ${formatGoalValue(p.goal.metric, p.remaining!)} untuk mencapai ${title}.`;
        return `${finding} ${p.remaining === 0 ? "" : p.daysRemaining > 0 ? `Perlu rata-rata ${formatGoalValue(p.goal.metric, p.requiredRemainingPace!)} per hari selama ${p.daysRemaining} hari tersisa.` : "Periode sudah selesai; tinjau penjualan periode ini sebelum menyusun target berikutnya."} ${scope}`;
      }
      return `${goalInsight(p)}${intent === "goal_supporting_products" ? " Nama produk belum lengkap, jadi saya belum bisa melihat produk pendukung target." : ""} ${scope}`;
    })
    .join("\n\n");
}
