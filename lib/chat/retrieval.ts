import type { BusinessMetrics } from "@/lib/types";
import type { GoalProgress } from "@/lib/goals";
import { metricLabels, periodLabels, goalInsight } from "@/lib/goals";
import { businessAnswerCopy } from "@/lib/copy/business-answer";
import { retrieveBusinessQuery } from "@/lib/queries";
import {
  businessQuerySchema,
  type BusinessFact,
  type VerifiedBusinessAnswer,
} from "@/lib/queries/model";
import { generateInsights } from "@/lib/insights/rules";
import { defaultTrendUnit } from "@/lib/queries/aggregates";
import { formatDate } from "@/lib/utils";
import { EntityRegistry } from "./privacy";
import {
  snapshotSchema,
  type BusinessQueryPlan,
  type BusinessSnapshot,
  type InformationRequest,
  type UnsupportedTopic,
} from "./model";

export const unsupportedCopy: Record<UnsupportedTopic, string> = {
  customers:
    "Saya belum memiliki data pelanggan untuk menilai pelanggan terbaik.",
  forecast:
    "Saya belum bisa membuat prediksi penjualan ke depan; saya bisa membantu melihat penjualan yang sudah terjadi.",
  inventory:
    "Sisa stok belum bisa diketahui karena data persediaan belum tersedia.",
  tax: "Pajak belum bisa dihitung karena informasi pajak belum tersedia.",
  net_profit:
    "Laba bersih belum tersedia di ringkasan bisnis. Pantau melalui Target Bisnis setelah biaya produk dan pengeluaran dilengkapi.",
};
export const goalAlias = (p: GoalProgress, registry: EntityRegistry) =>
  registry.register(
    p.goal.id,
    "goal",
    `${metricLabels[p.goal.metric]} ${periodLabels[p.goal.period]} (${formatDate(p.periodStart)}–${formatDate(p.periodEnd)})`,
  );
const goalQuestion = (r: InformationRequest) =>
  `${r.operation === "contribution" ? "Produk pendukung" : r.operation === "pace" ? "Per hari untuk" : r.operation === "remaining" ? "Berapa lagi" : "Status"} target ${r.metric ? (metricLabels[r.metric as keyof typeof metricLabels] ?? "") : ""} ${r.goalPeriod ? periodLabels[r.goalPeriod] : ""}`;

export function retrievePlan(
  plan: BusinessQueryPlan,
  metrics: BusinessMetrics,
  goals: GoalProgress[],
  registry: EntityRegistry,
) {
  const facts: BusinessSnapshot["facts"] = [],
    results: BusinessSnapshot["results"] = [];
  const limitations = new Set<VerifiedBusinessAnswer["limitations"][number]>();
  const answers: {
    request: InformationRequest;
    answer: VerifiedBusinessAnswer;
  }[] = [];
  const seenFacts = new Set<string>();
  const add = (
    fact: BusinessFact,
    topic: InformationRequest["topic"],
    p?: GoalProgress,
  ) => {
    const entity = fact.entity
      ? p &&
        [
          "actual",
          "target",
          "progress",
          "remaining",
          "expectedProgress",
          "daysRemaining",
          "requiredPace",
        ].includes(fact.field)
        ? goalAlias(p, registry)
        : registry.alias(
            fact.entity,
            topic === "channels" ? "channel" : "product",
          )
      : undefined;
    const safe = { ...fact, ...(entity ? { entity } : {}), topic };
    const key = JSON.stringify(safe);
    if (seenFacts.has(key) || facts.length >= 128) return;
    seenFacts.add(key);
    facts.push({ ...safe, id: `F${facts.length + 1}` });
  };
  for (const request of plan.requests) {
    const supportedMetrics: Partial<
      Record<InformationRequest["topic"], string[]>
    > = {
      revenue: ["revenue", "growth"],
      profit: ["grossProfit", "margin"],
      orders: ["orders", "growth"],
      aov: ["aov", "growth"],
      units: ["units"],
      growth: ["revenue", "growth"],
      goals: ["revenue", "orders", "units", "grossProfit", "netProfit"],
      trends: ["revenue"],
    };
    if (
      request.metric &&
      supportedMetrics[request.topic] &&
      !supportedMetrics[request.topic]!.includes(request.metric)
    ) {
      const answer: VerifiedBusinessAnswer = {
        query: null,
        status: "unavailable",
        facts: [],
        limitations: [],
        fallbackText:
          request.metric === "netProfit"
            ? unsupportedCopy.net_profit
            : "Angka tersebut belum tersedia untuk perbandingan yang diminta. Saya bisa membantu melihat penjualan atau target yang sudah tercatat.",
      };
      answers.push({ request, answer });
      results.push({ topic: request.topic, status: "unavailable" });
      continue;
    }
    if (request.topic === "trends") {
      const unit = defaultTrendUnit(metrics);
      for (const point of metrics.trends[unit].slice(-12)) {
        if (facts.length >= 128) break;
        if (
          !facts.some(
            (f) => f.bucket?.date === point.date && f.bucket.unit === unit,
          )
        )
          facts.push({
            id: `F${facts.length + 1}`,
            topic: "trends",
            field: "revenue",
            value: point.revenue,
            format: "currency",
            bucket: { date: point.date, unit },
          });
      }
      results.push({
        topic: "trends",
        status: metrics.trends[unit].length ? "answered" : "unavailable",
      });
      continue;
    }
    const names = request.entities.map((a) => {
      const entry = registry.get(a);
      if (!entry) throw new Error("Unknown retrieval entity");
      return entry.name;
    });
    const query = businessQuerySchema.parse({ ...request, entities: names });
    if (request.topic === "goals") {
      const eligible = goals.filter(
        (p) =>
          p.goal.enabled &&
          (!request.metric || p.goal.metric === request.metric) &&
          (!request.goalPeriod || p.goal.period === request.goalPeriod) &&
          (!request.entities.length ||
            request.entities.includes(goalAlias(p, registry))),
      );
      const selected = ["top", "bottom"].includes(request.operation)
        ? eligible
        : eligible.slice(0, 3);
      const answer = retrieveBusinessQuery(
        query,
        metrics,
        selected,
        goalQuestion(request),
      );
      answers.push({ request, answer });
      results.push({ topic: request.topic, status: answer.status });
      answer.limitations.forEach((l) => limitations.add(l));
      // Per-goal retrieval keeps supporting products tied to the right target.
      const matched = answer.facts
        .flatMap((f, index) => {
          if (f.field !== "actual") return [];
          const target = answer.facts[index + 1];
          const p = selected.find(
            (p) =>
              p.goal.metric === f.goal?.metric &&
              p.goal.period === f.goal?.period &&
              p.periodStart === f.goal?.start &&
              p.referenceDate === f.goal?.referenceDate &&
              p.actual === f.value &&
              p.target === target?.value,
          );
          return p ? [p] : [];
        })
        .slice(0, 3);
      for (const p of matched) {
        const one = retrieveBusinessQuery(
          {
            ...query,
            operation:
              request.operation === "top" || request.operation === "bottom"
                ? "status"
                : request.operation,
          },
          metrics,
          [p],
          goalQuestion(request),
        );
        one.facts.forEach((f) => add(f, "goals", p));
      }
    } else {
      const answer = retrieveBusinessQuery(query, metrics);
      answers.push({ request, answer });
      results.push({ topic: request.topic, status: answer.status });
      answer.limitations.forEach((l) => limitations.add(l));
      answer.facts.forEach((f) => add(f, request.topic));
      if (request.topic === "overview") {
        for (const field of [
          "orderGrowth",
          "aovGrowth",
          "profitGrowth",
        ] as const)
          add({ field, value: metrics[field], format: "percent" }, "overview");
      }
    }
  }
  const warnings = plan.requests.some((r) => r.topic === "warnings")
    ? generateInsights(metrics).map(({ id, kind }) => ({
        code: id as BusinessSnapshot["warnings"][number]["code"],
        kind,
      }))
    : [];
  const snapshot = snapshotSchema.parse({
    period: metrics.period,
    dataPeriod: metrics.dataPeriod,
    facts,
    warnings,
    results,
    limitations: [...limitations],
  });
  const strategic =
    ["diagnose", "prioritize", "recommend"].includes(plan.intent) ||
    plan.responseGoal === "identify_focus" ||
    plan.responseGoal === "support_goal";
  const supported = answers.filter((a) => a.answer.status === "answered");
  const shortAnswer = (item: {
    request: InformationRequest;
    answer: VerifiedBusinessAnswer;
  }) => {
    const { answer, request } = item;
    if (
      ["products", "channels"].includes(request.topic) &&
      !request.entities.length &&
      answer.query &&
      answer.facts[0]?.entity
    ) {
      const first = answer.facts[0].entity;
      return businessAnswerCopy(
        {
          ...answer,
          query: { ...answer.query, operation: "top" },
          facts: answer.facts.filter((f) => f.entity === first),
        },
        metrics,
      );
    }
    if (request.topic === "goals") {
      const f = answer.facts.find((f) => f.field === "actual");
      const p = goals.find(
        (p) =>
          f?.goal?.metric === p.goal.metric &&
          f.goal.start === p.periodStart &&
          f.value === p.actual &&
          p.target === answer.facts.find((f) => f.field === "target")?.value,
      );
      if (p)
        return `${goalInsight(p)} Periode ${formatDate(p.periodStart)}–${formatDate(p.periodEnd)}, dipantau hingga ${formatDate(p.referenceDate)}.`;
    }
    return answer.fallbackText;
  };
  let narrative: string;
  if (plan.intent === "explain" && plan.responseGoal === "direct_answer") {
    const overview = supported.find((a) => a.request.topic === "overview");
    const warning = supported.find((a) => a.request.topic === "warnings");
    narrative = `${overview?.answer.fallbackText ?? "Angka bisnis belum bisa diringkas."}${warning ? ` ${warning.answer.fallbackText.split(/\n\n/)[0]}` : ""}`;
  } else if (strategic) {
    const goal = supported.find((a) => a.request.topic === "goals");
    const overview = supported.find((a) => a.request.topic === "overview");
    const products = supported.find((a) => a.request.topic === "products");
    const channels = supported.find((a) => a.request.topic === "channels");
    const warning = supported.find((a) => a.request.topic === "warnings");
    const focus =
      plan.responseGoal === "support_goal" && goal
        ? goal
        : (overview ?? channels ?? products ?? warning);
    const lead =
      "Saya belum bisa memberi analisis lanjutan saat ini, tetapi saya bisa membantu membaca angka bisnis Anda.";
    const supporting =
      focus?.request.topic === "channels"
        ? channels
        : (warning ?? products ?? channels);
    const detail =
      (focus ? shortAnswer(focus) : null) ??
      "Belum ada angka yang sesuai untuk menjawab pertanyaan ini.";
    // One supporting observation and one existing action, without fabricating a cause.
    const support =
      supporting && supporting !== focus
        ? shortAnswer(supporting).split(/\n\n/)[0]
        : "";
    narrative = `${lead}\n\n${detail}${support ? ` ${support}` : ""}`;
  } else
    narrative =
      answers.map((a) => a.answer.fallbackText).join("\n\n") ||
      "Apa yang ingin Anda lihat lebih dekat? Saya bisa membantu membahas penjualan, produk, channel, dan target bisnis.";
  const limitationsText = plan.unsupported
    .map((t) => unsupportedCopy[t])
    .join(" ");
  const fallback = `${limitationsText}${limitationsText && plan.requests.length ? " Untuk bagian yang bisa dinilai: " : ""}${plan.requests.length || !limitationsText ? narrative : ""}`;
  return { snapshot, fallback, answers };
}
