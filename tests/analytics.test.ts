import { describe, expect, it } from "vitest";
import {
  aggregateTrends,
  analyzeBusiness,
  calculateProducts,
  calculateTotals,
  getHighestMarginProduct,
  getMonthlyRevenueGrowth,
  getMostProfitableProduct,
  getTopSellingProduct,
  growth,
  transactionRevenue,
} from "@/lib/analytics";
import { createDemoData } from "@/lib/demo";
import {
  answerQuestion,
  buildVerifiedContext,
  detectIntent,
  generateInsights,
} from "@/lib/insights";
import type { Product, Transaction, UploadedData } from "@/lib/types";

const products: Product[] = [{ id: "P1", name: "Brownie", cogs: 20000 }];
const row = (overrides: Partial<Transaction> = {}): Transaction => ({
  date: "2026-09-30",
  orderId: "A",
  productId: "P1",
  productName: "Brownie",
  quantity: 2,
  unitPrice: 50000,
  discount: 0,
  ...overrides,
});
const rows = [row(), row({ orderId: "B", quantity: 1 })];
const dataset = (
  transactions: Transaction[] = rows,
  catalog = products,
): UploadedData => ({
  transactions,
  products: catalog,
  expenses: [],
  source: { kind: "upload", name: "test.csv", loadedAt: "2026-10-06" },
});

describe("verified financial metrics", () => {
  it("calculates revenue, unique orders, units, AOV, COGS, gross profit and margin", () => {
    expect(calculateTotals(rows, products)).toEqual({
      revenue: 150000,
      orders: 2,
      units: 3,
      aov: 75000,
      cogs: 60000,
      grossProfit: 90000,
      grossMargin: 60,
      cogsCoverage: 100,
    });
  });
  it("counts an order with multiple product lines once", () => {
    expect(
      calculateTotals([row(), row({ productName: "Cookie" })], []).orders,
    ).toBe(1);
  });
  it("subtracts per-line discount when revenue is absent", () => {
    expect(transactionRevenue(row({ discount: 5000 }))).toBe(95000);
  });
  it("uses explicit revenue, including zero", () => {
    expect(transactionRevenue(row({ revenue: 70000 }))).toBe(70000);
    expect(transactionRevenue(row({ revenue: 0 }))).toBe(0);
  });
  it("does not invent COGS", () => {
    expect(calculateTotals(rows, [])).toMatchObject({
      cogs: null,
      grossProfit: null,
      grossMargin: null,
      cogsCoverage: 0,
    });
  });
  it("does not present partially known COGS as total profit", () => {
    const result = calculateTotals(
      [
        row(),
        row({ productId: "missing", productName: "Cookie", quantity: 1 }),
      ],
      products,
    );
    expect(result.cogs).toBeNull();
    expect(result.grossProfit).toBeNull();
    expect(result.cogsCoverage).toBeCloseTo(66.6666667);
  });
  it("matches normalized names when product ids are missing or unmatched", () => {
    expect(
      calculateTotals(
        [
          row({ productId: undefined, productName: "  BROWNIE  " }),
          row({ productId: "other" }),
        ],
        products,
      ).cogs,
    ).toBe(80000);
  });
  it("preserves known zero COGS", () => {
    expect(calculateTotals(rows, [{ name: "Brownie", cogs: 0 }])).toMatchObject(
      { cogs: 0, grossProfit: 150000, grossMargin: 100 },
    );
  });
  it("protects zero revenue and empty datasets from NaN", () => {
    expect(calculateTotals([row({ revenue: 0 })], products)).toMatchObject({
      revenue: 0,
      grossProfit: -40000,
      grossMargin: null,
    });
    expect(calculateTotals([], [])).toMatchObject({
      revenue: 0,
      orders: 0,
      aov: 0,
      grossMargin: null,
    });
    expect(analyzeBusiness(dataset([]))).toBeNull();
  });
  it("calculates product revenue, profit, margin, and contribution", () => {
    expect(calculateProducts(rows, products)[0]).toMatchObject({
      name: "Brownie",
      revenue: 150000,
      units: 3,
      cogs: 60000,
      grossProfit: 90000,
      margin: 60,
      contribution: 100,
    });
  });
  it("merges aliases using the product id", () => {
    expect(
      calculateProducts(
        [row(), row({ productName: "Fudgy Brownie" })],
        products,
      ),
    ).toHaveLength(1);
  });
  it("calculates comparable growth and handles zero baselines", () => {
    expect(growth(120, 100)).toBe(20);
    expect(growth(80, 100)).toBe(-20);
    expect(growth(10, 0)).toBeNull();
    expect(growth(0, 100)).toBe(-100);
  });
  it("uses equal adjacent 30-day windows anchored to the dataset", () => {
    const m = analyzeBusiness(
      dataset([
        row({ date: "2026-08-01", quantity: 1 }),
        row({ date: "2026-09-30", quantity: 2 }),
      ]),
    )!;
    expect(m.period).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
      days: 30,
      previousStart: "2026-08-02",
      previousEnd: "2026-08-31",
    });
    expect(m.revenue).toBe(100000);
    expect(m.revenueGrowth).toBeNull();
  });
  it("compares shorter equal windows when less than 60 days exist", () => {
    const m = analyzeBusiness(
      dataset([
        row({ date: "2026-09-29", quantity: 1 }),
        row({ date: "2026-09-30", quantity: 2 }),
      ]),
    )!;
    expect(m.period.days).toBe(1);
    expect(m.revenueGrowth).toBe(100);
    expect(m.profitGrowth).toBe(100);
  });
  it("has no invented comparison for one date", () => {
    const m = analyzeBusiness(dataset())!;
    expect(m.previous).toBeNull();
    expect(m.revenueGrowth).toBeNull();
    expect(m.period.previousStart).toBeNull();
  });
  it("groups daily, Monday-based weekly and monthly sales with missing days as zero", () => {
    const sample = [
      row({ date: "2026-09-01", quantity: 1 }),
      row({ date: "2026-09-03", quantity: 2 }),
    ];
    expect(
      aggregateTrends(sample, "2026-09-01", "2026-09-03", "day").map(
        (p) => p.revenue,
      ),
    ).toEqual([50000, 0, 100000]);
    expect(aggregateTrends(sample, "2026-09-01", "2026-09-03", "week")).toEqual(
      [{ date: "2026-08-31", revenue: 150000 }],
    );
    expect(
      aggregateTrends(sample, "2026-09-01", "2026-09-03", "month"),
    ).toEqual([{ date: "2026-09-01", revenue: 150000 }]);
  });
  it("calculates channel revenue and period expenses without deducting them from gross profit", () => {
    const data = dataset();
    data.expenses = [{ date: "2026-09-30", category: "Sewa", amount: 10000 }];
    const m = analyzeBusiness(data)!;
    expect(m.expenses).toBe(10000);
    expect(m.grossProfit).toBe(90000);
    expect(m.channels).toEqual([{ name: "Tanpa kanal", revenue: 150000 }]);
  });
});

describe("demo, insights and deterministic chat", () => {
  const demo = createDemoData(),
    m = analyzeBusiness(demo)!;
  it("creates reproducible six-month bakery transactions and complete costs", () => {
    expect(createDemoData().transactions).toEqual(demo.transactions);
    expect(demo.transactions.length).toBeGreaterThan(4000);
    expect(m.dataPeriod).toEqual({ start: "2026-04-01", end: "2026-09-30" });
    expect(m.cogsCoverage).toBe(100);
    expect(m.trends.month).toHaveLength(6);
    expect(m.channels).toHaveLength(3);
  });
  it("provides distinct product helpers", () => {
    expect(getTopSellingProduct(m)?.units).toBe(
      Math.max(...m.products.map((p) => p.units)),
    );
    expect(getMostProfitableProduct(m)?.grossProfit).toBe(
      Math.max(...m.products.map((p) => p.grossProfit!)),
    );
    expect(getHighestMarginProduct(m)?.margin).toBe(
      Math.max(...m.products.map((p) => p.margin!)),
    );
  });
  it("compares full calendar months and skips incomplete or insufficient months", () => {
    const monthly = getMonthlyRevenueGrowth(demo.transactions)!;
    expect(monthly.currentStart).toBe("2026-09-01");
    expect(monthly.previousStart).toBe("2026-08-01");
    expect(monthly.currentRevenue).toBe(m.trends.month.at(-1)!.revenue);
    expect(monthly.growth).toBeCloseTo(
      ((monthly.currentRevenue - monthly.previousRevenue) /
        monthly.previousRevenue) *
        100,
    );
    expect(
      getMonthlyRevenueGrowth(
        demo.transactions.filter((t) => t.date <= "2026-09-15"),
      )!.currentStart,
    ).toBe("2026-08-01");
    expect(getMonthlyRevenueGrowth(rows)).toBeNull();
  });
  it("generates 2–4 supported insights including low-margin warnings", () => {
    const insights = generateInsights(m);
    expect(insights.length).toBeGreaterThanOrEqual(2);
    expect(insights.length).toBeLessThanOrEqual(4);
    expect(insights.find((i) => i.id === "margin")?.body).toContain(
      "Ladyfinger",
    );
  });
  it("warns about missing costs without fabricating profit", () => {
    const without = analyzeBusiness({ ...demo, products: [] })!;
    expect(
      generateInsights(without).find((i) => i.id === "cost"),
    ).toBeDefined();
    expect(answerQuestion("Berapa laba saya?", without)).toContain("belum");
  });
  it.each([
    ["Bagaimana performa bisnis saya?", "overview"],
    ["Produk apa yang paling laris?", "bestseller"],
    ["Produk mana yang paling menguntungkan?", "profitable"],
    ["Margin tertinggi?", "margin"],
    ["Apakah penjualan saya meningkat?", "growth"],
    ["Produk apa yang perlu diperhatikan?", "warnings"],
    ["Berapa omzet?", "revenue"],
    ["Berapa keuntungan?", "profit"],
    ["Siapa pelanggan terbaik?", "unknown"],
  ])("detects %s", (question, intent) =>
    expect(detectIntent(question)).toBe(intent),
  );
  it("answers questions from calculated metrics", () => {
    expect(answerQuestion("Produk paling laris?", m)).toContain(
      getTopSellingProduct(m)!.name,
    );
    expect(answerQuestion("Bagaimana performa bisnis saya?", m)).toContain(
      m.orders.toLocaleString("id-ID"),
    );
    expect(answerQuestion("Siapa pelanggan terbaik?", m)).toContain(
      "belum cukup",
    );
  });
  it("only sends bounded metric summaries to AI, never raw transactions", () => {
    const context = buildVerifiedContext(m, "Produk paling laris?");
    expect(context.products).toHaveLength(1);
    expect(JSON.stringify(context)).not.toContain("orderId");
    expect(JSON.stringify(context)).not.toContain("transactions");
    expect(context.fallback).toContain("paling laris");
  });
});
