import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { analyzeBusiness } from "@/lib/analytics";
import { answerBusinessQuery } from "@/lib/queries";
import { generateInsights, buildVerifiedContext } from "@/lib/insights";
import {
  calculateGoal,
  goalInsight,
  answerGoalQuestion,
  type BusinessGoal,
} from "@/lib/goals";
import { businessAnswerCopy } from "@/lib/copy/business-answer";
import { entityLabel } from "@/lib/copy/entity-label";
import { prepareChatFacts } from "@/lib/ai/chat-facts";
import { ChannelPerformance } from "@/components/dashboard/channel-performance";
import { DataCapabilities } from "@/components/data/data-capabilities";
import type { UploadedData } from "@/lib/types";
import { formatRupiah, formatPercentage } from "@/lib/utils";

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
const goal: BusinessGoal = {
  id: "revenue-monthly",
  metric: "revenue",
  period: "monthly",
  target: 2000000,
  enabled: true,
  createdAt: "2026-09-01T00:00:00Z",
};
const words = (text: string) => text.trim().split(/\s+/).length;
const jargon =
  /\b(capability|coverage|schema|intent|fallback|null|undefined|unknown|unassigned_channel|COGS|AOV|revenue|gross profit|verified context)\b/i;

describe("business-first deterministic communication", () => {
  it.each([
    "Bagaimana performa bisnis saya?",
    "Berapa omzet?",
    "Apakah penjualan meningkat?",
    "Produk paling laris?",
    "Produk paling menguntungkan?",
    "Channel terbaik?",
    "Bandingkan Shopee dan Tokopedia",
    "Bandingkan Brownie dan Ladyfinger",
    "Produk apa yang perlu diperhatikan?",
    "Siapa pelanggan terbaik?",
    "Prediksi bulan depan?",
    "Berapa laba kotor?",
    "Berapa pesanan?",
    "Berapa rata-rata nilai transaksi?",
  ])("keeps %s concise and free of internal terminology", (question) => {
    const result = answerBusinessQuery(question, m);
    expect(result.fallbackText).not.toMatch(jargon);
    expect(result.fallbackText).not.toMatch(
      /^(berdasarkan|dari metrik|data menunjukkan|periode ringkasan)/i,
    );
    expect(words(result.fallbackText)).toBeLessThanOrEqual(100);
  });
  it("answers revenue directly, without unrelated shortages or extra KPIs", () => {
    const result = answerBusinessQuery("Berapa omzet?", m);
    expect(result.fallbackText).toMatch(/^Penjualan Anda/);
    expect(result.fallbackText).toContain(formatRupiah(m.revenue));
    expect(result.fallbackText).not.toMatch(
      /pesanan|unit|laba|belum tersedia/i,
    );
    expect(words(result.fallbackText)).toBeLessThan(30);
  });
  it.each([
    [-12, "turun 12%"],
    [12, "naik 12%"],
    [0, "tidak berubah"],
  ])("describes growth %s without inventing a cause", (growth, phrase) => {
    const metrics = { ...m, revenueGrowth: growth };
    const result = answerBusinessQuery(
      "Bagaimana performa bisnis saya?",
      metrics,
    );
    expect(result.fallbackText).toMatch(/^Penjualan/);
    expect(result.fallbackText).toContain(phrase);
    expect(result.fallbackText).not.toMatch(/karena|disebabkan/);
    expect(result.facts.find((f) => f.field === "growth")?.value).toBe(growth);
  });
  it("does not dump unrelated missing metrics into channel or product revenue answers", () => {
    const partial = analyzeBusiness({
      ...data,
      products: [],
      transactions: data.transactions.map((t) => ({
        ...t,
        quantity: 0,
        revenue: t.quantity * t.unitPrice,
        orderId: "",
      })),
    })!;
    for (const question of [
      "Channel terbaik?",
      "Produk paling berkontribusi?",
    ]) {
      const result = answerBusinessQuery(question, partial);
      expect(result.status).toBe("answered");
      expect(result.fallbackText).not.toMatch(
        /unit|pesanan|biaya|laba|margin|belum tersedia/i,
      );
    }
  });
  it("compares relevant product numbers without recalculating them or changing verified facts", () => {
    const result = answerBusinessQuery("Bandingkan Brownie dan Ladyfinger", m);
    const before = structuredClone(result);
    const text = businessAnswerCopy(result, m);
    expect(text).toMatch(/^Brownie memiliki penjualan lebih besar/);
    expect(text).toContain(formatRupiah(690000));
    expect(text).toContain(formatRupiah(310000));
    expect(text).not.toMatch(/margin|laba|unit|pertumbuhan/i);
    expect(result).toEqual(before);
    expect(
      result.facts.filter((f) => f.entity === "Brownie").map((f) => f.value),
    ).toEqual([690000, 69, 10, 490000, m.products[0].margin, null]);
  });
  it("does not describe a tied comparison as a winner", () => {
    const equal = {
      ...m,
      channels: [
        { name: "Shopee", revenue: 50 },
        { name: "Tokopedia", revenue: 50 },
      ],
    };
    expect(
      answerBusinessQuery("Bandingkan Shopee dan Tokopedia", equal)
        .fallbackText,
    ).toContain("yang sama");
  });
  it("explains only requested missing channel information", () => {
    const text = answerBusinessQuery("Margin channel Shopee?", m).fallbackText;
    expect(text).toContain("margin");
    expect(text).not.toMatch(/unit|pesanan|pertumbuhan|laba/i);
  });
  it("explains missing costs naturally without manufacturing profit", () => {
    const partial = analyzeBusiness({ ...data, products: [] })!;
    const result = answerBusinessQuery("Produk paling menguntungkan?", partial);
    expect(result.status).toBe("unavailable");
    expect(result.facts).toEqual([]);
    expect(result.fallbackText).toContain("biaya produk belum lengkap");
    expect(result.fallbackText).not.toContain("Rp0");
    expect(result.fallbackText).not.toMatch(jargon);
    expect(
      generateInsights(partial).find((i) => i.id === "cost")?.action,
    ).toContain("biaya per unit");
  });
  it("explains missing quantities when unit costs are known", () => {
    const metrics = analyzeBusiness({
      ...data,
      transactions: data.transactions.map((t) => ({
        ...t,
        revenue: t.quantity * t.unitPrice,
        quantity: 0,
      })),
    })!;
    const result = answerBusinessQuery("Berapa laba kotor?", metrics);
    expect(result.fallbackText).toContain("jumlah terjual belum lengkap");
    expect(
      result.facts.find((f) => f.field === "grossProfit")?.value,
    ).toBeNull();
    expect(
      generateInsights(metrics).find((i) => i.id === "cost")?.body,
    ).toContain("Jumlah terjual belum lengkap");
  });
  it("discloses partial profit rankings but not unrelated missing metrics", () => {
    const partial = analyzeBusiness({ ...data, products: [data.products[0]] })!;
    const result = answerBusinessQuery("Produk paling menguntungkan?", partial);
    expect(result.fallbackText).toContain("Brownie");
    expect(result.fallbackText).toContain(
      "Biaya sebagian produk belum lengkap",
    );
    expect(result.fallbackText).not.toMatch(/unit|pesanan|pertumbuhan/i);
    expect(result.facts.find((f) => f.field === "grossProfit")?.value).toBe(
      490000,
    );
  });
  it("keeps missing-channel caveats short and contribution accurate", () => {
    const partial = {
      ...m,
      channels: [
        { name: "Shopee", revenue: 25 },
        { name: "Tanpa kanal", revenue: 75 },
      ],
    };
    const result = answerBusinessQuery("Channel terbaik?", partial);
    expect(result.facts[1].value).toBe(25);
    expect(result.fallbackText).toContain("channel-nya sudah teridentifikasi");
    expect(result.fallbackText).toContain(
      "Sebagian transaksi belum memiliki informasi channel",
    );
    expect(result.fallbackText).not.toMatch(
      /Tanpa kanal|penyebut|peringkat channel bernama|unit|pesanan/,
    );
  });
  it.each([
    "unassigned_channel",
    "unknown",
    "null",
    "undefined",
    "Tanpa kanal",
  ])(
    "presents %s as a friendly label without altering facts or aliases",
    (name) => {
      const metrics = {
        ...m,
        channels: [
          { name: "Shopee", revenue: 10 },
          { name, revenue: 90 },
        ],
      };
      const html = renderToStaticMarkup(
        createElement(ChannelPerformance, { metrics }),
      );
      expect(html).toContain("Channel belum diketahui");
      expect(html).not.toContain(`>${name}<`);
      expect(entityLabel(name, "channel")).toBe("Channel belum diketahui");
      const result = answerBusinessQuery("Channel terbaik?", metrics);
      expect(result.fallbackText).not.toMatch(jargon);
      expect(result.fallbackText).not.toContain(
        "Pertahankan penjualan di Channel belum diketahui",
      );
      const prepared = prepareChatFacts(result, metrics.period);
      expect(prepared.payload.verifiedFacts).toHaveLength(result.facts.length);
      if (name !== "Tanpa kanal")
        expect(prepared.restore("ENTITAS_1_RAMU")).toBe(
          "Channel belum diketahui",
        );
    },
  );
  it("keeps unsupported customer and prediction explanations specific", () => {
    const customer = answerBusinessQuery("Siapa pelanggan terbaik?", m);
    const prediction = answerBusinessQuery("Prediksi bulan depan?", m);
    expect(customer.fallbackText).toContain("data pelanggan belum tersedia");
    expect(prediction.fallbackText).toContain("belum bisa membuat prediksi");
    expect(prediction.fallbackText).toContain("sudah terjadi");
    expect(customer.status).toBe("unsupported");
    expect(prediction.facts).toEqual([]);
  });
  it("keeps dashboard insights short, grounded, and independent of unrelated missing units", () => {
    const metrics = {
      ...m,
      revenueGrowth: -14,
      capabilities: { ...m.capabilities, units: false },
    };
    const insights = generateInsights(metrics);
    expect(insights.find((i) => i.id === "growth")?.body).toContain("14%");
    expect(insights.find((i) => i.id === "top")?.body).not.toMatch(
      /unit|belum tersedia/,
    );
    for (const i of insights) {
      expect(`${i.title} ${i.body} ${i.action}`).not.toMatch(jargon);
      expect(words(i.body)).toBeLessThan(40);
      expect(words(i.action)).toBeLessThan(25);
    }
  });
  it("uses natural unavailable labels in data status without changing availability", () => {
    const partialData = { ...data, products: [] };
    const metrics = analyzeBusiness(partialData)!;
    const html = renderToStaticMarkup(
      createElement(DataCapabilities, { metrics, data: partialData }),
    );
    expect(html).toContain("Biaya produk");
    expect(html).toContain("laba kotor");
    expect(html).not.toMatch(/HPP|COGS|coverage/);
    expect(metrics.grossProfit).toBeNull();
  });
  it("preserves verified Gemini payload boundaries after prose improvements", () => {
    const context = buildVerifiedContext(m, "Produk paling menguntungkan?");
    const prepared = prepareChatFacts(context.answer, context.overview.period);
    expect(prepared.payload.verifiedFacts.map((f) => f.value)).toEqual(
      context.answer.facts.map((f) => f.value),
    );
    const payload = JSON.stringify(prepared.payload);
    expect(payload).not.toMatch(
      /transactions|orderId|private-file|Brownie|Ladyfinger|fallbackText/,
    );
  });
});

describe("actionable goal communication", () => {
  it.each([
    [2000000, "behind", "masih tertinggal"],
    [1500000, "on-track", "masih sesuai jalur"],
    [1200000, "ahead", "lebih cepat dari rencana"],
    [500000, "completed", "sudah tercapai"],
  ] as const)(
    "describes the existing %s goal status without inventing progress",
    (target, status, phrase) => {
      const progress = calculateGoal({ ...goal, target }, data, "2026-09-20");
      const text = goalInsight(progress);
      expect(progress.paceStatus).toBe(status);
      expect(text).toContain(phrase);
      expect(text).toContain(formatPercentage(progress.progressPercentage!));
      expect(text).toContain(formatRupiah(progress.actual!));
      if (status !== "completed")
        expect(text).toContain(
          `${formatRupiah(progress.requiredRemainingPace!)} per hari`,
        );
      expect(text).not.toMatch(jargon);
      expect(words(text)).toBeLessThanOrEqual(100);
    },
  );
  it("answers remaining amount directly and ties the advice to the actual period", () => {
    const p = calculateGoal(goal, data, "2026-10-13");
    const text = answerGoalQuestion(
      "Berapa lagi target pendapatan bulan ini?",
      [p],
    );
    expect(text).toMatch(/^Masih perlu Rp1\.000\.000/);
    expect(text).toContain("Rp100.000 per hari");
    expect(text).toContain("20 Sep 2026");
    expect(text).not.toContain("Okt");
    expect(words(text)).toBeLessThanOrEqual(100);
  });
  it("does not imply time remains when the target period has ended", () => {
    const endData = {
      ...data,
      transactions: [
        ...data.transactions,
        {
          ...data.transactions[0],
          date: "2026-09-30",
          orderId: "last",
          quantity: 1,
          unitPrice: 1,
        },
      ],
    };
    const p = calculateGoal(goal, endData, "2026-10-13");
    expect(p.daysRemaining).toBe(0);
    expect(goalInsight(p)).toContain("Periode sudah selesai");
    expect(
      answerGoalQuestion("Berapa lagi target pendapatan?", [p]),
    ).not.toMatch(/per hari|Masih ada waktu/);
  });
  it("does not present revenue contribution as profit contribution for goal coaching", () => {
    const p = calculateGoal(
      { ...goal, metric: "grossProfit" },
      data,
      "2026-09-20",
    );
    const text = answerGoalQuestion(
      "Produk apa yang mendukung target laba kotor?",
      [p],
    );
    expect(text).toContain("Brownie");
    expect(text).toContain("69%");
    expect(text).toContain("bukan porsi laba");
  });
});
