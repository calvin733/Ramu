import { describe, expect, it } from "vitest";
import {
  answerGoalQuestion,
  calculateGoal,
  goalIntent,
  goalSchema,
  parseGoalTarget,
  parseStoredGoals,
  serializeGoals,
  type BusinessGoal,
} from "@/lib/goals";
import { createDemoData } from "@/lib/demo";
import { answerQuestion } from "@/lib/insights";
import { analyzeBusiness } from "@/lib/analytics";
import type { UploadedData } from "@/lib/types";
const data: UploadedData = {
  transactions: [
    {
      date: "2026-09-01",
      orderId: "A",
      productName: "Roti",
      quantity: 2,
      unitPrice: 100,
      discount: 0,
    },
    {
      date: "2026-09-20",
      orderId: "B",
      productName: "Roti",
      quantity: 3,
      unitPrice: 350 / 3,
      discount: 0,
    },
  ],
  products: [{ name: "Roti", cogs: 20 }],
  expenses: [{ date: "2026-09-01", category: "Sewa", amount: 60 }],
  expenseCoverage: { start: "2026-09-01", end: "2026-09-30" },
  source: {
    name: "data.csv",
    kind: "upload",
    loadedAt: "2026-09-20T00:00:00.000Z",
  },
};
const goal = (
  metric: BusinessGoal["metric"] = "revenue",
  period: BusinessGoal["period"] = "monthly",
  target = 1000,
): BusinessGoal => ({
  id: "test",
  metric,
  period,
  target,
  enabled: true,
  createdAt: "2026-09-01T00:00:00.000Z",
});
const calculate = (
  g = goal(),
  d: UploadedData | null = data,
  today = "2026-10-11",
) => calculateGoal(g, d, today);
describe("deterministic business goals", () => {
  it("calculates monthly actual, remaining, elapsed and required pace", () => {
    const p = calculate();
    expect(p.actual).toBe(550);
    expect(p.progressPercentage).toBeCloseTo(55);
    expect(p.remaining).toBe(450);
    expect(p.periodStart).toBe("2026-09-01");
    expect(p.periodEnd).toBe("2026-09-30");
    expect(p.daysElapsed).toBe(20);
    expect(p.daysRemaining).toBe(10);
    expect(p.expectedProgressToDate).toBeCloseTo((100 * 20) / 30);
    expect(p.requiredRemainingPace).toBe(45);
    expect(p.paceStatus).toBe("behind");
  });
  it("calculates daily revenue and completed goal without division by zero", () => {
    const p = calculate(goal("revenue", "daily", 300));
    expect(p.actual).toBe(350);
    expect(p.remaining).toBe(0);
    expect(p.paceStatus).toBe("completed");
    expect(p.requiredRemainingPace).toBe(0);
    expect(
      calculate(goal("revenue", "daily", 500)).requiredRemainingPace,
    ).toBeNull();
  });
  it("uses the current yearly period and calendar pace", () => {
    const p = calculate(goal("revenue", "yearly"));
    expect(p.actual).toBe(550);
    expect(p.referenceDate).toBe("2026-10-11");
    expect(p.periodStart).toBe("2026-01-01");
    expect(p.periodEnd).toBe("2026-12-31");
    expect(p.daysElapsed + p.daysRemaining).toBe(365);
  });
  it.each([
    ["orders", 2],
    ["units", 5],
    ["grossProfit", 450],
    ["netProfit", 390],
  ] as const)("calculates %s from available data", (metric, actual) =>
    expect(calculate(goal(metric)).actual).toBe(actual),
  );
  it("requires complete product costs and confirmed, relevant expense coverage for net profit", () => {
    expect(
      calculate(goal("grossProfit"), { ...data, products: [] }).actual,
    ).toBeNull();
    expect(
      calculate(goal("netProfit"), { ...data, expenseCoverage: undefined })
        .actual,
    ).toBeNull();
    expect(calculate(goal("netProfit", "yearly")).actual).toBeNull();
    expect(calculate(goal("netProfit"), { ...data, expenses: [] }).actual).toBe(
      450,
    );
  });
  it("does not treat rows as orders or invent missing units", () => {
    const incomplete = {
      ...data,
      transactions: data.transactions.map((t) => ({
        ...t,
        orderId: "",
        quantity: 0,
        revenue: 100,
      })),
    };
    expect(calculate(goal("orders"), incomplete).actual).toBeNull();
    expect(calculate(goal("units"), incomplete).actual).toBeNull();
    expect(calculate(goal("revenue"), incomplete).actual).toBe(200);
  });
  it.each([
    [750, "ahead"],
    [670, "on-track"],
    [550, "behind"],
    [1000, "completed"],
  ] as const)(
    "classifies actual %s as %s using ±5 percentage points",
    (actual, status) => {
      const d = {
        ...data,
        transactions: data.transactions.map((t, i) => ({
          ...t,
          revenue: i ? actual : 0,
        })),
      };
      expect(calculate(goal(), d).paceStatus).toBe(status);
    },
  );
  it("uses latest historical date and today's date when data includes current period", () => {
    expect(calculate().referenceDate).toBe("2026-09-20");
    const p = calculate(goal(), data, "2026-09-25");
    expect(p.referenceDate).toBe("2026-09-25");
    expect(p.latestDataDate).toBe("2026-09-20");
    expect(p.daysRemaining).toBe(5);
  });
  it("limits demo net-profit coverage to the supplied six months", () => {
    expect(
      calculateGoal(
        goal("netProfit", "monthly"),
        createDemoData(),
        "2026-10-11",
      ).actual,
    ).not.toBeNull();
    expect(
      calculateGoal(goal("netProfit", "yearly"), createDemoData(), "2026-10-11")
        .actual,
    ).toBeNull();
  });
  it("excludes future rows from actual progress", () =>
    expect(calculate(goal(), data, "2026-09-10").actual).toBe(200));
  it("handles unavailable session data and corrupt or future-version storage", () => {
    expect(calculate(goal(), null).actual).toBeNull();
    for (const raw of [
      null,
      "{",
      "null",
      '{"version":2,"goals":[]}',
      '{"version":1,"goals":[{"target":0}]}',
    ])
      expect(parseStoredGoals(raw)).toEqual([]);
    expect(parseStoredGoals(serializeGoals([goal()]))).toEqual([goal()]);
  });
  it.each([0, -1, NaN, Infinity])("rejects invalid target %s", (n) =>
    expect(() => goalSchema.parse(goal("revenue", "daily", n))).toThrow(),
  );
  it("parses Indonesian target money without accepting ambiguous input", () => {
    expect(parseGoalTarget("Rp100.000.000")).toBe(100000000);
    expect(parseGoalTarget("100000000")).toBe(100000000);
    for (const s of ["", "abc", "0", "-1", "1.2", "1e6", "1..000"])
      expect(() => parseGoalTarget(s)).toThrow();
    expect(() => goalSchema.parse(goal("orders", "monthly", 1.5))).toThrow();
  });
  it.each([
    ["Target bulan ini sudah sampai berapa?", "goal_progress"],
    ["Berapa lagi target pendapatan bulan ini?", "goal_remaining"],
    ["Apakah saya masih sesuai target?", "goal_status"],
    ["Berapa penjualan per hari yang dibutuhkan?", "goal_pace"],
    ["Produk apa paling membantu mencapai target?", "goal_supporting_products"],
  ])("handles goal intent %s", (q, intent) =>
    expect(goalIntent(q)).toBe(intent),
  );
  it("answers goal questions from verified goal calculations", () => {
    const progress = [calculate()];
    expect(
      answerGoalQuestion("Berapa lagi target pendapatan bulan ini?", progress),
    ).toContain("Rp450");
    expect(
      answerQuestion(
        "Berapa lagi target pendapatan bulan ini?",
        analyzeBusiness(data)!,
        progress,
      ),
    ).toContain("Rp45 per hari");
    expect(
      answerGoalQuestion("Produk apa mendukung target?", progress),
    ).toContain("Roti");
    expect(answerGoalQuestion("Target tahunan?", progress)).toContain(
      "Belum ada target",
    );
  });
});
