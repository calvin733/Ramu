import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generate };
  },
}));
import { POST as mapData } from "@/app/api/ai/map-data/route";
import { POST as explainGoals } from "@/app/api/ai/goals/route";
import { inferSheet, schemaMetadata } from "@/lib/mapping";
import { calculateGoal, type BusinessGoal } from "@/lib/goals";
import { createDemoData } from "@/lib/demo";
import { analyzeBusiness } from "@/lib/analytics";
import { buildVerifiedContext } from "@/lib/insights";
const input = schemaMetadata({
  name: "secret.xlsx",
  sheets: [
    inferSheet("Penjualan", [
      { Tanggal: "2026-09-30", Total: 123456, Email: "private@example.org" },
    ]),
  ],
});
const request = (body: unknown) =>
  new Request("http://localhost/api/ai/map-data", {
    method: "POST",
    body: JSON.stringify(body),
  });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("schema-only AI assistance", () => {
  it("works without Gemini and does not transmit cell values", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const result = await (await mapData(request(input))).json();
    expect(result.mode).toBe("basic");
    expect(result.sheets[0].mapping).toContainEqual({
      source: "Tanggal",
      target: "date",
      confidence: 1,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("accepts validated Gemini proposals and sends only safe metadata", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-placeholder");
    mocks.generate.mockResolvedValue({
      text: JSON.stringify({
        sheets: [
          {
            id: "0",
            sheetType: "transactions",
            mapping: [
              { source: "Tanggal", target: "date", confidence: 0.95 },
              { source: "Total", target: "revenue", confidence: 0.9 },
            ],
          },
        ],
      }),
    });
    const result = await (
      await mapData(
        request({
          sheets: input.sheets.map((s) => ({
            ...s,
            columns: [
              ...s.columns,
              { name: "Customer Name", inferredType: "string" },
            ],
          })),
        }),
      )
    ).json();
    expect(result.mode).toBe("gemini");
    const transmitted = mocks.generate.mock.calls[0][0].contents;
    for (const s of [
      "123456",
      "private@example.org",
      "Customer Name",
      "Email",
      "secret.xlsx",
      "2026-09-30",
    ])
      expect(transmitted).not.toContain(s);
  });
  it("falls back on invalid AI output, unknown IDs and provider failure", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-placeholder");
    for (const text of [
      "not-json",
      '{"sheets":[{"id":"bad","sheetType":"unknown","mapping":[]}]}',
      '{"sheets":[{"id":"0","sheetType":"transactions","mapping":[{"source":"Total","target":"revenue","confidence":2}]}]}',
    ]) {
      mocks.generate.mockResolvedValueOnce({ text });
      expect((await (await mapData(request(input))).json()).mode).toBe("basic");
    }
    mocks.generate.mockRejectedValueOnce(new Error("offline"));
    expect((await (await mapData(request(input))).json()).mode).toBe("basic");
  });
  it("rejects raw rows and oversized schema payloads", async () => {
    expect(
      (await mapData(request({ ...input, transactions: [{ revenue: 123 }] })))
        .status,
    ).toBe(400);
    expect((await mapData(request({ text: "x".repeat(65537) }))).status).toBe(
      400,
    );
  });
  it("explains goals using deterministic fallback and verified context", async () => {
    const data = createDemoData();
    const goal: BusinessGoal = {
      id: "test",
      metric: "revenue",
      period: "monthly",
      target: 100000000,
      createdAt: "2026-09-01T00:00:00.000Z",
      enabled: true,
    };
    const p = calculateGoal(goal, data, "2026-10-11");
    const context = buildVerifiedContext(
      analyzeBusiness(data)!,
      "Berapa lagi target pendapatan bulan ini?",
      [p],
    );
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await (await explainGoals(request({ context }))).json()).toEqual({
      text: context.fallback,
      mode: "basic",
    });
    vi.stubEnv("GEMINI_API_KEY", "test-only-placeholder");
    mocks.generate.mockResolvedValue({
      text: "Pertimbangkan menjaga kualitas produk andalan.",
    });
    expect((await (await explainGoals(request({ context }))).json()).mode).toBe(
      "gemini",
    );
    expect(
      JSON.parse(mocks.generate.mock.calls[0][0].contents).verifiedMetrics
        .goals[0].actual,
    ).toBe(p.actual);
    expect(
      (
        await explainGoals(
          request({
            context: {
              ...context,
              goals: [{ ...context.goals[0], actual: "guessed" }],
            },
          }),
        )
      ).status,
    ).toBe(400);
  });
});
