import type { BusinessInsight, BusinessMetrics } from "@/lib/types";
import { formatDate, formatPercentage, formatRupiah } from "@/lib/utils";
import { entityLabel } from "@/lib/copy/entity-label";
import { formatGoalValue, metricLabels, type GoalProgress } from "@/lib/goals";
import { channelPerformance } from "@/lib/queries/aggregates";

export interface DashboardDecision extends BusinessInsight {
  goalId?: string;
  topic: "health" | "product" | "channel" | "goal";
  evidence: string[];
  // References identify the existing aggregates behind the presentation.
  sources: string[];
}
export function relevantGoals(goals: GoalProgress[]) {
  const order = { behind: 0, "on-track": 1, ahead: 2, completed: 3 };
  return goals
    .filter((p) => p.goal.enabled)
    .toSorted(
      (a, b) =>
        (a.paceStatus ? order[a.paceStatus] : 4) -
          (b.paceStatus ? order[b.paceStatus] : 4) ||
        a.daysRemaining - b.daysRemaining,
    );
}
export function dashboardDecisions(
  m: BusinessMetrics,
  insights: BusinessInsight[],
  goals: GoalProgress[],
): DashboardDecision[] {
  const candidates: DashboardDecision[] = [];
  const period = `${formatDate(m.period.start)}–${formatDate(m.period.end)}`;
  const addInsight = (
    id: string,
    topic: DashboardDecision["topic"],
    evidence: string[],
    sources: string[],
  ) => {
    const insight = insights.find((i) => i.id === id);
    if (insight) candidates.push({ ...insight, topic, evidence, sources });
  };
  const salesEvidence = [`Penjualan ${formatRupiah(m.revenue)} · ${period}`];
  if (m.revenueGrowth !== null && m.revenueGrowth < -10)
    addInsight("growth", "health", salesEvidence, [
      "revenue",
      "revenueGrowth",
      "period",
    ]);
  const goal = relevantGoals(goals).find((p) => p.paceStatus === "behind");
  if (goal)
    candidates.push({
      id: `goal-${goal.goal.id}`,
      goalId: goal.goal.id,
      topic: "goal",
      kind: "warning",
      title: `Target ${metricLabels[goal.goal.metric].toLowerCase()} ${goal.daysRemaining > 0 ? "perlu dikejar" : "belum tercapai"}`,
      body: `Sudah ${formatPercentage(goal.progressPercentage!)} tercapai, sementara ${formatPercentage(goal.expectedProgressToDate)} periode berjalan.`,
      evidence: [
        `Sisa ${formatGoalValue(goal.goal.metric, goal.remaining!)} · ${goal.daysRemaining} hari tersisa`,
        `${formatDate(goal.periodStart)}–${formatDate(goal.periodEnd)} · data sampai ${formatDate(goal.referenceDate)}`,
      ],
      action:
        goal.daysRemaining > 0 && goal.requiredRemainingPace !== null
          ? `Perlu rata-rata ${formatGoalValue(goal.goal.metric, goal.requiredRemainingPace)} per hari. Tinjau produk atau channel yang bisa Anda dorong.`
          : "Periode target sudah berakhir. Gunakan hasil ini untuk menyesuaikan rencana periode berikutnya.",
      sources: [
        "goal.progressPercentage",
        "goal.expectedProgressToDate",
        "goal.remaining",
        "goal.requiredRemainingPace",
        "goal.period",
      ],
    });
  const declining = m.products.find(
    (p) =>
      p.revenue > 0 &&
      p.contribution >= 25 &&
      p.growth !== null &&
      p.growth < -10,
  );
  if (declining)
    candidates.push({
      id: "declining-major",
      topic: "product",
      kind: "warning",
      title: "Produk utama sedang melemah",
      body: `${entityLabel(declining.name)} masih menyumbang ${formatPercentage(declining.contribution)} penjualan, tetapi penjualannya turun ${formatPercentage(Math.abs(declining.growth!))}.`,
      evidence: [
        `Penjualan produk ${formatRupiah(declining.revenue)} · ${period}`,
      ],
      action:
        "Tinjau perubahan penjualan produk ini sebelum menambah diskon atau biaya promosi.",
      sources: ["products.contribution", "products.growth", "products.revenue"],
    });
  if (m.revenue > 0 && m.products[0]?.contribution > 40)
    addInsight(
      "top",
      "product",
      [`Penjualan produk ${formatRupiah(m.products[0].revenue)} · ${period}`],
      ["products.contribution", "products.revenue"],
    );
  addInsight(
    "margin",
    "product",
    [`Biaya produk yang sudah tercatat · ${period}`],
    ["products.margin"],
  );
  const growing = m.products
    .slice(1)
    .find(
      (p) =>
        p.revenue > 0 &&
        p.contribution >= 5 &&
        p.growth !== null &&
        p.growth > 10,
    );
  if (growing)
    candidates.push({
      id: "growing-secondary",
      topic: "product",
      kind: "opportunity",
      title: "Produk lain mulai menguat",
      body: `Penjualan ${entityLabel(growing.name)} naik ${formatPercentage(growing.growth!)} dan menyumbang ${formatPercentage(growing.contribution)} penjualan.`,
      evidence: [
        `Penjualan produk ${formatRupiah(growing.revenue)} · ${period}`,
      ],
      action:
        "Coba tonjolkan produk ini dalam satu penawaran, lalu lihat hasilnya sebelum memperbesar promosi.",
      sources: ["products.growth", "products.contribution", "products.revenue"],
    });
  if (m.revenueGrowth !== null && m.revenueGrowth > 10)
    addInsight("growth", "health", salesEvidence, [
      "revenue",
      "revenueGrowth",
      "period",
    ]);
  const channel = channelPerformance(m).find(
    (c) => c.name !== "Tanpa kanal" && c.revenue > 0,
  );
  if (channel && channel.contribution !== null)
    candidates.push({
      id: "channel-focus",
      topic: "channel",
      kind: "performance",
      title: "Jaga channel penjualan terkuat",
      body: `${entityLabel(channel.name, "channel")} menyumbang ${formatPercentage(channel.contribution)} penjualan.`,
      evidence: [
        `Penjualan channel ${formatRupiah(channel.revenue)} · ${period}`,
      ],
      action:
        "Jaga kelancaran penjualan di channel ini. Bandingkan channel lain sebelum menambah upaya promosi.",
      sources: ["channels.revenue", "channels.contribution"],
    });
  const missing = relevantGoals(goals).find((p) => p.actual === null);
  if (missing)
    candidates.push({
      id: `goal-data-${missing.goal.id}`,
      goalId: missing.goal.id,
      topic: "goal",
      kind: "performance",
      title: "Target belum bisa dipantau",
      body: missing.missing ?? "Informasi untuk target ini belum lengkap.",
      evidence: [`Target ${metricLabels[missing.goal.metric].toLowerCase()}`],
      action: "Lengkapi informasi yang dibutuhkan target ini di Data Bisnis.",
      sources: ["goal.missing"],
    });
  if (!candidates.length)
    candidates.push({
      id: "sales-check",
      topic: "health",
      kind: "performance",
      title:
        m.revenueGrowth === null
          ? "Penjualan Anda sudah terbaca"
          : "Pantau perubahan penjualan",
      body:
        m.revenueGrowth === null
          ? "Belum ada perbandingan penjualan yang setara. Ringkasan ini menunjukkan penjualan yang tercatat."
          : m.revenueGrowth === 0
            ? "Penjualan sama dengan periode sebelumnya."
            : `Penjualan ${m.revenueGrowth > 0 ? "naik" : "turun"} ${formatPercentage(Math.abs(m.revenueGrowth))} dibanding periode sebelumnya.`,
      evidence: salesEvidence,
      action:
        "Lihat pola penjualan harian untuk menentukan periode yang ingin Anda tinjau lebih dekat.",
      sources: ["revenue", "revenueGrowth", "period"],
    });
  const topics = new Set<DashboardDecision["topic"]>();
  return candidates
    .filter((d) => {
      if (topics.has(d.topic)) return false;
      topics.add(d.topic);
      return true;
    })
    .slice(0, 3);
}
