import type { BusinessMetrics } from "@/lib/types";
import {
  answerGoalQuestion,
  type GoalProgress,
  metricLabels,
  periodLabels,
} from "@/lib/goals";
import { generateInsights } from "@/lib/insights/rules";
import {
  formatDate,
  formatNumber,
  formatPercentage,
  formatRupiah,
} from "@/lib/utils";
import { channelPerformance } from "./aggregates";
import { understandQuery, unsupportedReason } from "./understand";
import type {
  BusinessFact,
  BusinessQuery,
  VerifiedBusinessAnswer,
} from "./model";
export { understandQuery } from "./understand";
export type { BusinessQuery, VerifiedBusinessAnswer } from "./model";
const labels: Record<BusinessFact["field"], string> = {
  revenue: "Pendapatan",
  units: "Unit terjual",
  orders: "Pesanan",
  aov: "Rata-rata pesanan",
  grossProfit: "Laba kotor",
  margin: "Margin",
  growth: "Pertumbuhan pendapatan",
  orderGrowth: "Pertumbuhan pesanan",
  aovGrowth: "Pertumbuhan rata-rata pesanan",
  profitGrowth: "Pertumbuhan laba kotor",
  contribution: "Kontribusi pendapatan",
  target: "Target",
  actual: "Aktual",
  progress: "Progress",
  remaining: "Sisa",
  expectedProgress: "Progress waktu",
  daysRemaining: "Hari tersisa",
  requiredPace: "Kebutuhan per hari",
};
const fact = (
  field: BusinessFact["field"],
  value: number | null,
  format: BusinessFact["format"],
  entity?: string,
): BusinessFact => ({ field, value, format, ...(entity ? { entity } : {}) });
const display = (f: BusinessFact) =>
  f.value === null
    ? "belum tersedia"
    : f.format === "currency"
      ? formatRupiah(f.value)
      : f.format === "percent"
        ? formatPercentage(f.value)
        : formatNumber(f.value);
const describe = (facts: BusinessFact[]) =>
  facts.map((f) => `${labels[f.field]} ${display(f)}`).join("; ");

export function answerBusinessQuery(
  question: string,
  m: BusinessMetrics,
  goals: GoalProgress[] = [],
  previous?: BusinessQuery | null,
): VerifiedBusinessAnswer {
  const query = understandQuery(question, m, previous);
  const limitations: VerifiedBusinessAnswer["limitations"] = [];
  const result = (
    text: string,
    facts: BusinessFact[] = [],
    status: VerifiedBusinessAnswer["status"] = "answered",
  ): VerifiedBusinessAnswer => ({
    query,
    status,
    facts,
    limitations,
    fallbackText: text,
  });
  const unsupported = unsupportedReason(question);
  if (unsupported) return result(unsupported, [], "unsupported");
  if (!query)
    return result(
      "Saya belum yakin informasi yang Anda maksud. Sebutkan metrik, produk, atau channel, misalnya ‘Berapa kontribusi Shopee?’ atau ‘Bandingkan dua produk’. Saya dapat membaca pendapatan, pesanan, unit, laba kotor, pertumbuhan, dan target dari data ini.",
      [],
      "clarification",
    );
  const { topic, operation, entities } = query;
  const period = `${formatDate(m.period.start)}–${formatDate(m.period.end)}`;
  const scope = `Periode ringkasan ${period}.`;
  if (topic === "channels") {
    const all = channelPerformance(m);
    if (all.some((c) => c.name === "Tanpa kanal"))
      limitations.push("unassigned_channel");
    let rows = all.filter((c) => c.name !== "Tanpa kanal");
    if (!rows.length)
      return result(
        "Data channel belum tersedia pada file yang sedang digunakan.",
        [],
        "unavailable",
      );
    if (
      (query.metric && !["revenue", "contribution"].includes(query.metric)) ||
      operation === "change"
    )
      return result(
        "Agregat channel saat ini hanya menyediakan pendapatan dan kontribusi pendapatan. Unit, pesanan, laba, margin, dan pertumbuhan per channel belum tersedia.",
        [],
        "unavailable",
      );
    if (
      (operation === "compare" && entities.length < 2) ||
      (operation === "contribution" && !entities.length)
    )
      return result(
        "Sebutkan nama channel yang tercatat. Untuk perbandingan, pilih dua channel dari data aktif.",
        [],
        "clarification",
      );
    if (entities.length) rows = rows.filter((c) => entities.includes(c.name));
    if (operation === "bottom") rows = [...rows].reverse();
    if (query.rank) rows = rows.slice(query.rank - 1, query.rank);
    else if (["top", "bottom"].includes(operation)) rows = rows.slice(0, 1);
    else rows = rows.slice(0, 8);
    if (!rows.length)
      return result(
        "Peringkat atau channel tersebut belum tersedia dalam data aktif.",
        [],
        "unavailable",
      );
    const facts = rows.flatMap((c) => [
      fact("revenue", c.revenue, "currency", c.name),
      fact("contribution", c.contribution, "percent", c.name),
    ]);
    const title = query.rank
      ? `Peringkat ${query.rank} berdasarkan pendapatan`
      : operation === "top"
        ? "Channel dengan pendapatan terbesar"
        : operation === "bottom"
          ? "Channel dengan pendapatan terendah"
          : "Channel penjualan";
    return result(
      `${title}: ${rows.map((c) => `${c.name}, ${formatRupiah(c.revenue)} (${c.contribution === null ? "kontribusi belum tersedia karena total pendapatan nol" : `${formatPercentage(c.contribution)} dari total pendapatan channel tercatat`})`).join("; ")}. ${scope}${all.some((c) => c.name === "Tanpa kanal") ? " Sebagian pendapatan berlabel Tanpa kanal; kategori ini masuk penyebut kontribusi tetapi bukan peringkat channel bernama." : ""}${all.length > 8 && !entities.length && !query.rank && !["top", "bottom"].includes(operation) ? " Ditampilkan maksimal 8 channel." : ""}`,
      facts,
    );
  }
  if (topic === "products") {
    if (!m.capabilities.products || !m.products.length)
      return result(
        "Data nama produk belum tersedia lengkap untuk analisis produk.",
        [],
        "unavailable",
      );
    const metric =
      operation === "change" && query.metric === "revenue"
        ? "growth"
        : (query.metric ?? "revenue");
    if (["orders", "aov", "netProfit"].includes(metric))
      return result(
        "Agregat produk belum menyediakan pesanan, rata-rata pesanan, atau laba bersih per produk. Gunakan pendapatan, unit, laba kotor, margin, atau pertumbuhan pendapatan.",
        [],
        "unavailable",
      );
    if (operation === "change" && !["revenue", "growth"].includes(metric))
      return result(
        "Perubahan per produk yang tersedia hanya pertumbuhan pendapatan. Pertumbuhan unit, laba, dan margin per produk belum tersedia.",
        [],
        "unavailable",
      );
    if (metric === "units" && !m.capabilities.units)
      return result(
        "Data nama produk dan jumlah unit belum tersedia lengkap untuk menentukan produk terlaris atau jumlah unit.",
        [],
        "unavailable",
      );
    if (
      (operation === "compare" && entities.length < 2) ||
      (operation === "contribution" && !entities.length)
    )
      return result(
        `Sebutkan nama produk yang tercatat. Untuk perbandingan, pilih dua produk dari data aktif: ${m.products
          .slice(0, 8)
          .map((p) => p.name)
          .join(", ")}.`,
        [],
        "clarification",
      );
    const key = metric as
      | "revenue"
      | "units"
      | "grossProfit"
      | "margin"
      | "growth"
      | "contribution";
    let rows = entities.length
      ? m.products.filter((p) => entities.includes(p.name))
      : [...m.products];
    const ranking =
      ["top", "bottom", "ranking"].includes(operation) || !entities.length;
    const before = rows.length;
    if (ranking)
      rows = rows
        .filter((p) => p[key] !== null)
        .sort((a, b) => b[key]! - a[key]! || a.name.localeCompare(b.name));
    const partial = rows.length < before;
    if (partial) limitations.push("available_products_only");
    if (key === "growth") limitations.push("historical_comparison");
    if (operation === "bottom") rows.reverse();
    if (query.rank) rows = rows.slice(query.rank - 1, query.rank);
    else if (["top", "bottom"].includes(operation)) rows = rows.slice(0, 1);
    else rows = rows.slice(0, operation === "compare" ? 8 : 5);
    if (!rows.length)
      return result(
        `Data ${metric === "grossProfit" || metric === "margin" ? "biaya" : labels[key].toLowerCase()} atau peringkat yang diminta belum tersedia. Tidak ada nilai yang digantikan dengan nol.`,
        [],
        "unavailable",
      );
    if (key === "growth" && operation === "bottom" && rows[0].growth! >= 0)
      return result(
        `Tidak ada penurunan pada produk dengan pembanding tersedia. ${scope}`,
      );
    const productFacts = rows.map((p) => [
      fact("revenue", p.revenue, "currency", p.name),
      fact(
        "contribution",
        m.revenue > 0 ? p.contribution : null,
        "percent",
        p.name,
      ),
      fact("units", m.capabilities.units ? p.units : null, "number", p.name),
      fact("grossProfit", p.grossProfit, "currency", p.name),
      fact("margin", p.margin, "percent", p.name),
      fact("growth", p.growth, "percent", p.name),
    ]);
    let intro = query.rank
      ? `Produk peringkat ${query.rank} berdasarkan ${labels[key].toLowerCase()}: `
      : operation === "top" && key === "units"
        ? "Produk paling laris adalah "
        : operation === "top" && key === "grossProfit"
          ? "Produk dengan laba kotor terbesar: "
          : operation === "top" && key === "margin"
            ? "Produk dengan margin tertinggi: "
            : `${ranking ? `Peringkat produk berdasarkan ${labels[key].toLowerCase()}` : "Analisis produk"}: `;
    intro += `${rows.map((p) => p.name).join(", ")}. ${scope}${partial ? " Peringkat hanya mencakup produk dengan metrik tersedia." : ""}`;
    return result(
      `${intro}\n\n${rows.map((p, i) => `${p.name}: ${describe(productFacts[i])}.`).join("\n\n")}`,
      productFacts.flat(),
      (key === "contribution" && m.revenue <= 0) ||
        rows.every((p) => p[key] === null)
        ? "unavailable"
        : "answered",
    );
  }
  if (topic === "goals") {
    limitations.push("goal_periods");
    let selected = goals.filter(
      (p) =>
        p.goal.enabled &&
        (!query.goalPeriod || p.goal.period === query.goalPeriod),
    );
    if (
      query.metric &&
      ["revenue", "orders", "units", "grossProfit", "netProfit"].includes(
        query.metric,
      )
    )
      selected = selected.filter((p) => p.goal.metric === query.metric);
    if (!selected.length)
      return result(
        "Belum ada target aktif yang sesuai. Buat Target Bisnis terlebih dahulu agar RAMU dapat membantu memantau kemajuannya.",
        [],
        "unavailable",
      );
    if (operation === "bottom" || operation === "top") {
      selected = selected.filter((p) => p.progressPercentage !== null);
      selected.sort(
        (a, b) =>
          a.progressPercentage! -
          a.expectedProgressToDate -
          (b.progressPercentage! - b.expectedProgressToDate),
      );
      if (operation === "top") selected.reverse();
      if (
        operation === "bottom" &&
        !selected.some((p) => p.paceStatus === "behind")
      )
        return result(
          "Tidak ada target berstatus Perlu dikejar di antara target dengan progress tersedia. Target tanpa data belum dapat dinilai.",
        );
      selected = selected.slice(0, 1);
    }
    selected = selected.slice(0, operation === "contribution" ? 4 : 8);
    const facts = selected.flatMap((p) => {
      const entity = `${metricLabels[p.goal.metric]} ${periodLabels[p.goal.period]} (${p.periodStart}–${p.periodEnd}, acuan ${p.referenceDate})`;
      const format = ["units", "orders"].includes(p.goal.metric)
        ? "number"
        : "currency";
      const goal = {
        metric: p.goal.metric,
        period: p.goal.period,
        start: p.periodStart,
        end: p.periodEnd,
        referenceDate: p.referenceDate,
      };
      return [
        fact("actual", p.actual, format, entity),
        fact("target", p.target, format, entity),
        fact("progress", p.progressPercentage, "percent", entity),
        fact("remaining", p.remaining, format, entity),
        fact("expectedProgress", p.expectedProgressToDate, "percent", entity),
        fact("daysRemaining", p.daysRemaining, "number", entity),
        fact("requiredPace", p.requiredRemainingPace, format, entity),
        ...(operation === "contribution"
          ? p.supportingProducts.flatMap((x) => [
              fact("revenue", x.revenue, "currency", x.name),
              fact("contribution", x.contribution, "percent", x.name),
            ])
          : []),
      ].map((f) => ({ ...f, goal }));
    });
    // Reuse the existing goal narrative and calculations, including supporting products.
    return result(
      answerGoalQuestion(question, selected),
      facts,
      selected.some((p) => p.actual !== null) ? "answered" : "unavailable",
    );
  }
  if (topic === "warnings") {
    const warnings = generateInsights(m).filter((i) => i.kind === "warning");
    return result(
      warnings.length
        ? warnings.map((i) => `${i.body} ${i.action}`).join("\n\n")
        : "Tidak ada peringatan yang terpicu oleh aturan analisis pada periode ini. Tetap pantau perubahan pendapatan dan margin produk.",
    );
  }
  const overview = [
    fact("revenue", m.revenue, "currency"),
    fact("orders", m.capabilities.orders ? m.orders : null, "number"),
    fact("units", m.capabilities.units ? m.units : null, "number"),
    fact("aov", m.capabilities.orders ? m.aov : null, "currency"),
    fact("grossProfit", m.grossProfit, "currency"),
    fact("margin", m.grossMargin, "percent"),
    fact("growth", m.revenueGrowth, "percent"),
  ];
  const fields: Record<string, BusinessFact["field"][]> = {
    overview: overview.map((f) => f.field),
    revenue: ["revenue", "growth"],
    orders: ["orders"],
    units: ["units"],
    aov: ["aov"],
    profit: query.metric === "margin" ? ["margin"] : ["grossProfit", "margin"],
    growth: ["growth"],
  };
  if (operation === "change" && ["orders", "aov", "profit"].includes(topic)) {
    if (topic === "profit" && query.metric === "margin")
      return result(
        "Pertumbuhan margin belum tersedia. RAMU dapat menjelaskan pertumbuhan laba kotor jika data pembanding lengkap.",
        [],
        "unavailable",
      );
    const field =
      topic === "orders"
        ? "orderGrowth"
        : topic === "aov"
          ? "aovGrowth"
          : "profitGrowth";
    const value = m[field];
    limitations.push("historical_comparison");
    return result(
      `${scope} ${describe([fact(field, value, "percent")])}. Perbandingan dengan ${m.period.days} hari sebelumnya.`,
      [fact(field, value, "percent")],
      value === null ? "unavailable" : "answered",
    );
  }
  if (
    operation === "change" &&
    !["growth", "overview", "revenue"].includes(topic)
  )
    return result(
      "Perubahan metrik tersebut belum tersedia dalam jawaban ini. Tanyakan pertumbuhan pendapatan atau lihat indikator pembanding di Dashboard.",
      [],
      "unavailable",
    );
  const facts = overview.filter((f) => fields[topic].includes(f.field));
  return result(
    `${scope} ${describe(facts)}.${fields[topic].includes("growth") ? ` Pertumbuhan membandingkan ${m.period.days} hari sebelumnya; nilai belum tersedia jika data pembanding tidak cukup atau pendapatan awal nol.` : ""}${topic === "profit" ? " Laba kotor belum dikurangi biaya operasional dan pajak; biaya lengkap diperlukan untuk menghitungnya." : ""}`,
    facts,
    facts.every((f) => f.value === null) ? "unavailable" : "answered",
  );
}

export function suggestedQuestions(m: BusinessMetrics, goals: GoalProgress[]) {
  return [
    "Bagaimana performa bisnis saya?",
    ...(channelPerformance(m).length
      ? ["Channel mana yang paling besar?"]
      : []),
    ...(m.capabilities.products
      ? ["Produk mana yang paling berkontribusi?"]
      : []),
    ...(m.capabilities.products && m.capabilities.units
      ? ["Produk apa yang paling laris?"]
      : []),
    ...(m.products.some((p) => p.grossProfit !== null)
      ? ["Produk mana yang paling menguntungkan?"]
      : []),
    ...(goals.some((p) => p.goal.enabled)
      ? [
          goals.some(
            (p) =>
              p.goal.enabled &&
              p.goal.metric === "revenue" &&
              p.goal.period === "monthly",
          )
            ? "Berapa lagi target pendapatan bulan ini?"
            : "Apakah saya masih sesuai target?",
        ]
      : []),
    ...(m.revenueGrowth !== null ? ["Apakah penjualan saya meningkat?"] : []),
  ];
}
