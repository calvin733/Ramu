import { describe, expect, it } from "vitest";
import { analyzeBusiness } from "@/lib/analytics";
import { calculateGoal, type BusinessGoal } from "@/lib/goals";
import type { UploadedData } from "@/lib/types";
import {
  answerBusinessQuery,
  understandQuery,
  suggestedQuestions,
} from "@/lib/queries";
import { channelPerformance, trendExtremes } from "@/lib/queries/aggregates";
import { businessQuerySchema, verifiedAnswerSchema } from "@/lib/queries/model";
import { buildVerifiedContext } from "@/lib/insights";
import { prepareChatFacts } from "@/lib/ai/chat-facts";
const data: UploadedData = {
  transactions: [
    {
      date: "2026-09-20",
      orderId: "1",
      productName: "Brownie",
      quantity: 7,
      unitPrice: 60000,
      discount: 0,
      channel: "Shopee",
    },
    {
      date: "2026-09-20",
      orderId: "2",
      productName: "Ladyfinger",
      quantity: 5,
      unitPrice: 62000,
      discount: 0,
      channel: "Tokopedia",
    },
    {
      date: "2026-09-20",
      orderId: "3",
      productName: "Brownie",
      quantity: 3,
      unitPrice: 90000,
      discount: 0,
      channel: "Offline",
    },
  ],
  products: [
    { name: "Brownie", cogs: 20000 },
    { name: "Ladyfinger", cogs: 50000 },
  ],
  expenses: [],
  source: { kind: "upload", name: "private-file.xlsx", loadedAt: "2026-10-12" },
};
const m = analyzeBusiness(data)!;
const answer = (q: string) => answerBusinessQuery(q, m);
describe("composable business query understanding", () => {
  it.each([
    ["Channel penjualan terbaik apa?", "channels", "top"],
    ["Channel mana paling besar?", "channels", "top"],
    ["Marketplace dengan penjualan tertinggi?", "channels", "top"],
    ["Penjualan paling banyak datang dari mana?", "channels", "top"],
    ["Channel paling rendah?", "channels", "bottom"],
    ["Berapa kontribusi Shopee?", "channels", "contribution"],
    ["Bandingkan Shopee dengan Offline", "channels", "compare"],
    ["Produk terbaik apa?", "products", "top"],
    ["Produk kedua terlaris?", "products", "ranking"],
    ["Berapa kontribusi Brownie?", "products", "contribution"],
    ["Bandingkan Brownie dan Ladyfinger", "products", "compare"],
    ["Produk dengan margin tertinggi?", "products", "top"],
    ["Penjualan saya gimana?", "overview", "summary"],
    ["Omzet saya berapa?", "revenue", "summary"],
    ["Revenue bisnis saya?", "revenue", "summary"],
    ["Pendapatan periode ini?", "revenue", "summary"],
    ["Berapa total unit terjual?", "units", "summary"],
    ["Berapa rata-rata nilai transaksi?", "aov", "summary"],
    ["Bagaimana penjualan dibanding periode sebelumnya?", "growth", "change"],
    ["Target mana yang paling tertinggal?", "goals", "bottom"],
    ["Which channel has the highest revenue?", "channels", "top"],
    ["Compare Brownie vs Ladyfinger", "products", "compare"],
  ])("understands %s", (q, topic, operation) =>
    expect(understandQuery(q, m)).toMatchObject({ topic, operation }),
  );
  it("detects case-insensitive whole entities without substring collisions", () => {
    expect(
      understandQuery("Bandingkan BROWNIE dan ladyfinger!", m)?.entities.sort(),
    ).toEqual(["Brownie", "Ladyfinger"]);
    expect(understandQuery("Berapa kontribusi shopee?", m)?.entities).toEqual([
      "Shopee",
    ]);
    expect(understandQuery("Berapa kontribusi Shopeepalsu?", m)).toBeNull();
    const collision = {
      ...m,
      products: [...m.products, { ...m.products[0], name: "Shopee" }],
    };
    expect(understandQuery("Kontribusi Shopee", collision)).toBeNull();
    expect(understandQuery("Kontribusi channel Shopee", collision)?.topic).toBe(
      "channels",
    );
  });
  it("uses only session-local recent topic for explicit follow-ups", () => {
    const first = understandQuery("Channel terbaik?", m)!;
    const second = answerBusinessQuery("Kalau yang kedua?", m, [], first);
    expect(second.query).toMatchObject({
      topic: "channels",
      operation: "ranking",
      rank: 2,
    });
    expect(second.facts[0]).toMatchObject({
      entity: "Tokopedia",
      value: 310000,
    });
    expect(answerBusinessQuery("Kalau yang kedua?", m).status).toBe(
      "clarification",
    );
    expect(
      answerBusinessQuery("Siapa pelanggan terbaik?", m, [], first).status,
    ).toBe("unsupported");
  });
});
describe("verified aggregate retrieval", () => {
  it("returns exact channel ranking, shares and comparison", () => {
    expect(answer("Channel terbaik?").facts).toEqual([
      { entity: "Shopee", field: "revenue", value: 420000, format: "currency" },
      { entity: "Shopee", field: "contribution", value: 42, format: "percent" },
    ]);
    expect(answer("Channel paling rendah?").facts[0]).toMatchObject({
      entity: "Offline",
      value: 270000,
    });
    expect(answer("Berapa kontribusi Shopee?").facts[1].value).toBe(42);
    expect(
      answer("Bandingkan Shopee dengan Offline").facts.map((f) => f.value),
    ).toEqual([420000, 42, 270000, 27]);
  });
  it("compares product values without deriving new financial formulas", () => {
    const comparison = answer("Bandingkan Brownie dan Ladyfinger");
    expect(
      comparison.facts
        .filter((f) => f.entity === "Brownie")
        .map((f) => f.value),
    ).toEqual([690000, 69, 10, 490000, m.products[0].margin, null]);
    expect(answer("Produk kedua terlaris?").facts[0].entity).toBe("Ladyfinger");
    expect(
      answer("Berapa kontribusi Brownie?").facts.find(
        (f) => f.field === "contribution",
      )?.value,
    ).toBe(69);
    expect(answer("Produk dengan margin tertinggi?").facts[0].entity).toBe(
      "Brownie",
    );
    expect(
      answer("Produk mana yang paling berkontribusi?").facts[0].entity,
    ).toBe("Brownie");
  });
  it.each([
    ["Berapa omzet?", "revenue", 1000000],
    ["Berapa pesanan?", "orders", 3],
    ["Berapa unit terjual?", "units", 15],
    ["Berapa rata-rata nilai transaksi?", "aov", 1000000 / 3],
    ["Berapa laba kotor?", "grossProfit", 550000],
  ])("answers %s exactly", (q, field, value) =>
    expect(
      answer(q as string).facts.find((f) => f.field === field)?.value,
    ).toBe(value),
  );
  it("preserves unavailable metrics and zero denominator", () => {
    const partial = analyzeBusiness({
      ...data,
      transactions: data.transactions.map((t) => ({
        ...t,
        quantity: 0,
        orderId: "",
        channel: undefined,
        revenue: 100,
      })),
      products: [],
    })!;
    expect(answerBusinessQuery("Channel terbaik?", partial)).toMatchObject({
      status: "unavailable",
      facts: [],
    });
    expect(
      answerBusinessQuery("Berapa pesanan?", partial).facts[0].value,
    ).toBeNull();
    expect(answerBusinessQuery("Produk terlaris?", partial).status).toBe(
      "unavailable",
    );
    expect(suggestedQuestions(partial, [])).not.toContain(
      "Produk mana yang paling menguntungkan?",
    );
    const zero = analyzeBusiness({
      ...data,
      transactions: data.transactions.map((t) => ({ ...t, revenue: 0 })),
    })!;
    expect(channelPerformance(zero).every((c) => c.contribution === null)).toBe(
      true,
    );
    expect(
      answerBusinessQuery("Kontribusi Brownie", zero).facts.find(
        (f) => f.field === "contribution",
      )?.value,
    ).toBeNull();
    expect(answerBusinessQuery("Kontribusi Brownie", zero).status).toBe(
      "unavailable",
    );
  });
  it("does not answer a missing product margin or unsupported unit growth with other metrics", () => {
    const withoutCosts = analyzeBusiness({ ...data, products: [] })!;
    expect(
      answerBusinessQuery("Berapa margin Brownie?", withoutCosts).status,
    ).toBe("unavailable");
    expect(answer("Bagaimana pertumbuhan unit Brownie?")).toMatchObject({
      status: "unavailable",
      facts: [],
    });
    expect(answer("Produk mana unitnya turun paling besar?")).toMatchObject({
      status: "unavailable",
      facts: [],
    });
    const metrics = {
      ...m,
      products: m.products.map((p) => ({ ...p, growth: 12 })),
    };
    const revenueChange = answerBusinessQuery(
      "Pendapatan Brownie dibanding periode sebelumnya?",
      metrics,
    );
    expect(revenueChange.query?.operation).toBe("change");
    expect(revenueChange.facts.find((f) => f.field === "growth")?.value).toBe(
      12,
    );
  });
  it("retrieves existing order, AOV and gross-profit growth without recalculating it", () => {
    const metrics = { ...m, orderGrowth: -7, aovGrowth: 4, profitGrowth: 9 };
    for (const [question, field, value] of [
      ["Apakah pesanan meningkat?", "orderGrowth", -7],
      [
        "Bagaimana rata-rata pesanan dibanding periode sebelumnya?",
        "aovGrowth",
        4,
      ],
      ["Apakah laba kotor meningkat?", "profitGrowth", 9],
    ] as const) {
      const result = answerBusinessQuery(question, metrics);
      expect(result.facts).toEqual([{ field, value, format: "percent" }]);
      expect(verifiedAnswerSchema.safeParse(result).success).toBe(true);
    }
    expect(answer("Apakah pesanan meningkat?").status).toBe("unavailable");
  });
  it("does not equate unassigned channels with a real channel", () => {
    const partial = {
      ...m,
      channels: [
        { name: "Shopee", revenue: 25 },
        { name: "Tanpa kanal", revenue: 75 },
      ],
    };
    const a = answerBusinessQuery("Channel terbaik?", partial);
    expect(a.facts[1].value).toBe(25);
    expect(a.fallbackText).toContain("belum memiliki informasi channel");
  });
  it("keeps unknown, unsupported and missing data distinct", () => {
    expect(answer("Apa maksudnya?").status).toBe("clarification");
    expect(answer("Bandingkan Shopee dan Lazada").status).toBe("clarification");
    expect(answer("Pertumbuhan channel Shopee?").status).toBe("unavailable");
    expect(answer("Produk ketiga terlaris?").status).toBe("unavailable");
    expect(answer("Unit terjual channel Shopee?").status).toBe("unavailable");
  });
  it.each([
    ["Siapa pelanggan terbaik?", "data pelanggan"],
    ["Prediksi penjualan bulan depan?", "prediksi"],
    ["Stok Brownie berapa?", "persediaan"],
    ["Berapa pajak saya?", "pajak"],
  ])("explains specific unsupported feature: %s", (q, text) => {
    expect(answer(q).status).toBe("unsupported");
    expect(answer(q).fallbackText).toContain(text);
  });
  it("ranks existing product growth and skips unknown growth without mutation", () => {
    const metrics = {
      ...m,
      products: m.products.map((p, i) => ({
        ...p,
        growth: i === 0 ? -10 : -30,
      })),
    };
    const before = JSON.stringify(metrics);
    expect(
      answerBusinessQuery("Produk mana yang turun paling besar?", metrics)
        .facts[0].entity,
    ).toBe("Ladyfinger");
    expect(JSON.stringify(metrics)).toBe(before);
    expect(answer("Produk mana yang turun paling besar?").status).toBe(
      "unavailable",
    );
  });
  it("uses existing goal progress, remaining, pace and most-behind gap", () => {
    const goal: BusinessGoal = {
      id: "1",
      metric: "revenue",
      period: "monthly",
      target: 2000000,
      createdAt: "2026-09-01T00:00:00Z",
      enabled: true,
    };
    const progress = calculateGoal(goal, data, "2026-09-20");
    const other = calculateGoal(
      { ...goal, id: "2", metric: "orders", target: 100 },
      data,
      "2026-09-20",
    );
    const a = answerBusinessQuery("Target mana yang paling tertinggal?", m, [
      progress,
      other,
    ]);
    expect(a.facts[0].value).toBe(other.actual);
    expect(
      answerBusinessQuery("Berapa lagi target pendapatan bulan ini?", m, [
        progress,
      ]).facts.find((f) => f.field === "remaining")?.value,
    ).toBe(progress.remaining);
    expect(
      answerBusinessQuery("Berapa target pendapatan per hari?", m, [
        progress,
      ]).facts.find((f) => f.field === "requiredPace")?.value,
    ).toBe(progress.requiredRemainingPace);
  });
  it("keeps each goal and its supporting products tied to their actual period in Gemini facts", () => {
    const goal: BusinessGoal = {
      id: "1",
      metric: "revenue",
      period: "monthly",
      target: 2000000,
      createdAt: "2026-09-01T00:00:00Z",
      enabled: true,
    };
    const progress = [
      calculateGoal(goal, data, "2026-09-20"),
      calculateGoal({ ...goal, id: "2", period: "yearly" }, data, "2026-09-20"),
    ];
    const result = answerBusinessQuery(
      "Produk apa yang mendukung target pendapatan?",
      m,
      progress,
    );
    expect(verifiedAnswerSchema.safeParse(result).success).toBe(true);
    const prepared = prepareChatFacts(result, m.period);
    const contributions = prepared.payload.verifiedFacts.filter(
      (f) => f.field === "contribution",
    );
    expect(new Set(contributions.map((f) => f.goal?.start))).toEqual(
      new Set(["2026-09-01", "2026-01-01"]),
    );
    expect(
      contributions.every(
        (f) =>
          f.goal?.metric === "revenue" && f.goal.referenceDate === "2026-09-20",
      ),
    ).toBe(true);
    expect(JSON.stringify(prepared.payload)).not.toContain("Brownie");
    expect(JSON.stringify(prepared.payload)).not.toContain("private-file.xlsx");
  });
  it("selects trend extremes deterministically, including zero buckets and ties", () => {
    expect(
      trendExtremes([
        { date: "2026-09-01", revenue: 0 },
        { date: "2026-09-02", revenue: 100 },
        { date: "2026-09-03", revenue: 100 },
      ]),
    ).toEqual({
      best: { date: "2026-09-02", revenue: 100 },
      weakest: { date: "2026-09-01", revenue: 0 },
    });
    expect(trendExtremes([])).toBeNull();
  });
  it("validates bounds and never sends raw rows, questions, source or business names to Gemini chat", () => {
    const context = buildVerifiedContext(m, "Berapa kontribusi Shopee?");
    expect(context.channels).toEqual([
      { name: "Shopee", revenue: 420000, contribution: 42 },
    ]);
    expect(verifiedAnswerSchema.safeParse(context.answer).success).toBe(true);
    expect(
      businessQuerySchema.safeParse({ ...context.answer.query, revenue: 123 })
        .success,
    ).toBe(false);
    const prepared = prepareChatFacts(context.answer, context.overview.period);
    const payload = JSON.stringify(prepared.payload);
    for (const privateText of [
      "transactions",
      "orderId",
      "Shopee",
      "private-file.xlsx",
      "fallbackText",
    ])
      expect(payload).not.toContain(privateText);
    expect(prepared.restore("ENTITAS_1_RAMU: 42%.")).toBe("Shopee: 42%.");
  });
});
