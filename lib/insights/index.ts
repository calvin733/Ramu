import { goalIntent, type GoalProgress } from "@/lib/goals";
import type { BusinessMetrics, Intent } from "@/lib/types";
import {
  getBusinessOverview,
  getHighestMarginProduct,
  getMostProfitableProduct,
  getTopSellingProduct,
} from "@/lib/analytics";
import { answerBusinessQuery, type BusinessQuery } from "@/lib/queries";
import { channelPerformance } from "@/lib/queries/aggregates";

export { generateInsights, getBusinessWarnings } from "./rules";
import { generateInsights } from "./rules";
export function detectIntent(question: string): Intent {
  const goal = goalIntent(question);
  if (goal) return goal;
  const q = question.toLowerCase();
  if (
    /prediksi|forecast|besok|bulan depan|tahun depan|stok|pelanggan|segmen|pajak|laba bersih|net profit/.test(
      q,
    )
  )
    return "unknown";
  if (
    /paling menguntungkan|paling untung|produk.*(laba|profit|keuntungan)/.test(
      q,
    )
  )
    return "profitable";
  if (/margin/.test(q)) return "margin";
  if (/terlaris|paling laris|best seller|bestseller/.test(q))
    return "bestseller";
  if (/perlu diperhatikan|perhatian|peringatan|risiko/.test(q))
    return "warnings";
  if (/meningkat|naik|turun|pertumbuhan|tumbuh|growth/.test(q)) return "growth";
  if (/performa|kinerja|ringkasan|kabar bisnis/.test(q)) return "overview";
  if (/profit|laba|keuntungan/.test(q)) return "profit";
  if (/pendapatan|omzet|revenue/.test(q)) return "revenue";
  return "unknown";
}
export function answerQuestion(
  question: string,
  m: BusinessMetrics,
  goals: GoalProgress[] = [],
) {
  return answerBusinessQuery(question, m, goals).fallbackText;
}

export function buildVerifiedContext(
  m: BusinessMetrics,
  question?: string,
  goals: GoalProgress[] = [],
  previousQuery?: BusinessQuery | null,
) {
  const intent = question ? detectIntent(question) : "overview";
  const answer = answerBusinessQuery(
    question ?? "Bagaimana performa bisnis saya?",
    m,
    goals,
    previousQuery,
  );
  const selectedNames = new Set(
    answer.facts.map((f) => f.entity).filter(Boolean),
  );
  return {
    answer,
    channels: channelPerformance(m)
      .filter((c) => selectedNames.has(c.name) || selectedNames.size === 0)
      .slice(0, 8),
    overview: getBusinessOverview(m),
    expenses: m.capabilities.expenses ? m.expenses : null,
    goals: goals.slice(0, 8).map((p) => ({
      metric: p.goal.metric,
      period: p.goal.period,
      target: p.target,
      actual: p.actual,
      progressPercentage: p.progressPercentage,
      remaining: p.remaining,
      expectedProgressToDate: p.expectedProgressToDate,
      paceStatus: p.paceStatus,
      requiredRemainingPace: p.requiredRemainingPace,
      daysRemaining: p.daysRemaining,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      referenceDate: p.referenceDate,
      missing: p.missing,
      supportingProducts: p.supportingProducts,
    })),
    intent,
    products: (answer.query?.topic === "products" && selectedNames.size
      ? m.products.filter((p) => selectedNames.has(p.name)).slice(0, 8)
      : intent === "bestseller"
        ? [getTopSellingProduct(m)]
        : intent === "profitable"
          ? [getMostProfitableProduct(m)]
          : intent === "margin"
            ? [getHighestMarginProduct(m)]
            : m.products.slice(0, 8)
    )
      .filter((p) => p !== null)
      .map((p) => ({ ...p, units: m.capabilities.units ? p.units : null })),
    insights: generateInsights(m),
    fallback: question
      ? answer.fallbackText
      : generateInsights(m)
          .map((i) => `${i.body} ${i.action}`)
          .join("\n\n"),
  };
}
export type VerifiedContext = ReturnType<typeof buildVerifiedContext>;
