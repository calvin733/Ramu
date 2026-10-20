import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { analyzeBusiness } from "@/lib/analytics";
import { generateInsights } from "@/lib/insights";
import { calculateGoal, type BusinessGoal } from "@/lib/goals";
import { inferSheet, normalizeImport } from "@/lib/mapping";
import { dashboardDecisions, relevantGoals } from "@/lib/dashboard/decisions";
import { completeTrendPeriods } from "@/lib/dashboard/periods";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { ProductPreview } from "@/components/dashboard/product-preview";
import { PeriodHighlights } from "@/components/dashboard/period-highlights";
const data = (rows: Record<string, unknown>[]) =>
  normalizeImport({
    name: "sales.csv",
    sheets: [inferSheet("Penjualan", rows)],
  });
const decision = (rows: Record<string, unknown>[]) => {
  const m = analyzeBusiness(data(rows))!;
  return { m, list: dashboardDecisions(m, generateInsights(m), []) };
};
const goal = (target: number, id = "g"): BusinessGoal => ({
  id,
  metric: "revenue",
  period: "monthly",
  target,
  enabled: true,
  createdAt: "2026-09-01T00:00:00Z",
});
describe("evidence-backed dashboard decisions", () => {
  it("gives a revenue-only owner one supported KPI and an actionable observation", () => {
    const { m, list } = decision([{ date: "2026-09-20", revenue: 120 }]);
    const html = renderToStaticMarkup(
      createElement(DashboardSummary, { metrics: m }),
    );
    expect(html.match(/class="panel kpi-card"/g)).toHaveLength(1);
    expect(html).not.toMatch(/Belum tersedia|Pesanan|Laba Kotor|Produk/);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("sales-check");
    expect(list[0].evidence[0]).toContain("Rp120");
    expect(list[0].action).toContain("harian");
  });
  it("does not present an insufficient comparison or zero baseline as zero growth", () => {
    for (const rows of [
      [{ date: "2026-09-20", revenue: 0 }],
      [
        { date: "2026-09-19", revenue: 0 },
        { date: "2026-09-20", revenue: 100 },
      ],
    ]) {
      const { m, list } = decision(rows);
      expect(m.revenueGrowth).toBeNull();
      expect(list[0].body).toContain("Belum ada perbandingan");
      expect(
        renderToStaticMarkup(createElement(DashboardSummary, { metrics: m })),
      ).not.toContain("Perubahan Penjualan");
    }
  });
  it("keeps known zero sales available", () => {
    const { m } = decision([{ date: "2026-09-20", revenue: 0 }]);
    const html = renderToStaticMarkup(
      createElement(DashboardSummary, { metrics: m }),
    );
    expect(html).toContain("Rp0");
    expect(html).not.toContain("kpi-value-missing");
  });
  it("puts a significant sales decline before product/channel details", () => {
    const { list } = decision([
      {
        date: "2026-09-19",
        revenue: 1000,
        product_name: "Roti",
        channel: "Toko",
      },
      {
        date: "2026-09-20",
        revenue: 500,
        product_name: "Roti",
        channel: "Toko",
      },
    ]);
    expect(list[0].id).toBe("growth");
    expect(list[0].kind).toBe("warning");
    expect(list[0].sources).toContain("revenueGrowth");
    expect(new Set(list.map((i) => i.topic)).size).toBe(list.length);
    expect(list.length).toBeLessThanOrEqual(3);
  });
  it("prioritizes a behind-pace goal over product concentration", () => {
    const d = data([
      { date: "2026-09-20", revenue: 500, product_name: "Roti" },
    ]);
    const m = analyzeBusiness(d)!,
      p = calculateGoal(goal(10000), d, "2026-09-20");
    const list = dashboardDecisions(m, generateInsights(m), [p]);
    expect(list[0].topic).toBe("goal");
    expect(list[0].body).toContain("5%");
    expect(list[0].action).toContain("Rp950");
    expect(p.requiredRemainingPace).toBe(950);
    expect(list[0].evidence.join(" ")).toContain("10 hari");
  });
  it("never recommends chasing a closed goal period", () => {
    const d = data([{ date: "2026-09-30", revenue: 500 }]),
      m = analyzeBusiness(d)!;
    const p = calculateGoal(goal(10000), d, "2026-10-20");
    const first = dashboardDecisions(m, generateInsights(m), [p])[0];
    expect(first.action).toContain("sudah berakhir");
    expect(first.action).not.toContain("per hari");
  });
  it("uses the existing pace state to choose one relevant enabled goal", () => {
    const d = data([{ date: "2026-09-20", revenue: 500 }]);
    const ahead = calculateGoal(goal(100, "ahead"), d, "2026-09-20");
    const behind = calculateGoal(goal(10000, "behind"), d, "2026-09-20");
    const disabled = {
      ...behind,
      goal: { ...behind.goal, enabled: false, id: "off" },
    };
    expect(
      relevantGoals([ahead, disabled, behind]).map((p) => p.goal.id),
    ).toEqual(["behind", "ahead"]);
  });
  it("highlights a declining major product without repeating concentration for that product", () => {
    const { list } = decision([
      { date: "2026-09-19", product_name: "Roti", revenue: 80 },
      { date: "2026-09-19", product_name: "Kue", revenue: 20 },
      { date: "2026-09-20", product_name: "Roti", revenue: 50 },
      { date: "2026-09-20", product_name: "Kue", revenue: 50 },
    ]);
    const product = list.find((i) => i.topic === "product")!;
    expect(product.id).toBe("declining-major");
    expect(product.body).toContain("Roti");
    expect(product.sources).toContain("products.growth");
    expect(list.filter((i) => i.topic === "product")).toHaveLength(1);
  });
  it("recognizes high concentration without fabricating a cause", () => {
    const { list } = decision([
      { date: "2026-09-20", product_name: "Brownie", revenue: 90 },
      { date: "2026-09-20", product_name: "Roti", revenue: 10 },
    ]);
    expect(list[0].id).toBe("top");
    expect(list[0].body).toContain("90%");
    expect(list[0].action).toContain("produk lain");
    expect(JSON.stringify(list)).not.toMatch(
      /pelanggan menyukai|iklan efektif|pasti naik|pesaing/,
    );
  });
  it("recognizes a growing secondary product with existing growth facts", () => {
    const previous = [25, 10, 25, 25, 15],
      current = [25, 20, 20, 20, 15];
    const { list } = decision([
      ...previous.flatMap((revenue, i) => [
        { date: "2026-09-19", product_name: `Produk ${i}`, revenue },
      ]),
      ...current.flatMap((revenue, i) => [
        { date: "2026-09-20", product_name: `Produk ${i}`, revenue },
      ]),
    ]);
    expect(list[0].id).toBe("growing-secondary");
    expect(list[0].body).toContain("100%");
    expect(list[0].action).toContain("Coba");
  });
  it("does not make incomplete cost data a warning unless an explicit goal needs it", () => {
    const d = data([{ date: "2026-09-20", revenue: 500 }]),
      m = analyzeBusiness(d)!;
    expect(
      dashboardDecisions(m, generateInsights(m), []).map((i) => i.id),
    ).not.toContain("cost");
    const p = calculateGoal(
      { ...goal(10000), metric: "grossProfit" },
      d,
      "2026-09-20",
    );
    expect(dashboardDecisions(m, generateInsights(m), [p])[0].id).toContain(
      "goal-data",
    );
  });
  it("distinguishes revenue leaders from profit leaders when all product costs exist", () => {
    const { m } = decision([
      {
        date: "2026-09-20",
        product_name: "Terlaris",
        revenue: 100,
        quantity: 1,
        cogs: 99,
      },
      {
        date: "2026-09-20",
        product_name: "Untung",
        revenue: 90,
        quantity: 1,
        cogs: 10,
      },
    ]);
    const html = renderToStaticMarkup(
      createElement(ProductPreview, { metrics: m }),
    );
    expect(m.products[0].name).toBe("Terlaris");
    expect(html).toContain("Laba kotor terbesar");
    expect(html).toContain("Untung");
    expect(m.grossProfit).toBe(81);
  });
  it("uses the existing margin warning instead of a new profitability formula", () => {
    const { m, list } = decision(
      [10, 70, 70].map((cogs, i) => ({
        date: "2026-09-20",
        product_name: `P${i}`,
        revenue: 100,
        quantity: 1,
        cogs,
      })),
    );
    expect(list[0].id).toBe("margin");
    expect(list[0].body).toBe(
      generateInsights(m).find((i) => i.id === "margin")!.body,
    );
  });
  it("does not allocate a channel decision without identified channel data", () => {
    const { list } = decision([{ date: "2026-09-20", revenue: 100 }]);
    expect(list.some((i) => i.topic === "channel")).toBe(false);
  });
  it("does not mutate financial metrics or goal results while selecting decisions", () => {
    const d = data([{ date: "2026-09-20", revenue: 100 }]),
      m = analyzeBusiness(d)!;
    const goals = [calculateGoal(goal(10000), d, "2026-09-20")];
    const before = JSON.stringify({ m, goals });
    dashboardDecisions(m, generateInsights(m), goals);
    expect(JSON.stringify({ m, goals })).toBe(before);
  });
});
describe("period-safe chart highlights", () => {
  it("excludes partial month/week edges without altering chart values", () => {
    const { m } = decision([
      { date: "2026-08-15", revenue: 10000 },
      { date: "2026-09-30", revenue: 100 },
      { date: "2026-10-03", revenue: 50000 },
    ]);
    const before = JSON.stringify(m.trends);
    const periods = completeTrendPeriods(m, "month");
    expect(periods.partialCount).toBe(2);
    expect(periods.complete.map((p) => p.date)).toEqual(["2026-09-01"]);
    const html = renderToStaticMarkup(
      createElement(PeriodHighlights, { metrics: m, unit: "month" }),
    );
    expect(html).not.toContain("Bulan terbaik");
    expect(html).toContain("Bulan tercatat");
    expect(html).toContain("belum lengkap");
    expect(completeTrendPeriods(m, "week").partialCount).toBeGreaterThan(0);
    expect(JSON.stringify(m.trends)).toBe(before);
  });
  it("does not rank the same one-day period twice", () => {
    const { m } = decision([{ date: "2026-09-20", revenue: 100 }]);
    const html = renderToStaticMarkup(
      createElement(PeriodHighlights, { metrics: m, unit: "day" }),
    );
    expect(html).toContain("Hari tercatat");
    expect(html).not.toMatch(/terbaik|terendah/);
  });
});
