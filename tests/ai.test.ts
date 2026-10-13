import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generate };
  },
}));
import { handleAi } from "@/lib/ai/server";
import { createDemoData } from "@/lib/demo";
import { analyzeBusiness } from "@/lib/analytics";
import { buildVerifiedContext } from "@/lib/insights";
const context = buildVerifiedContext(
  analyzeBusiness(createDemoData())!,
  "Bagaimana performa bisnis saya?",
);
const request = (body: unknown) =>
  new Request("http://localhost/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("optional server-side Gemini", () => {
  it("returns deterministic fallback without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const response = await handleAi(
      request({ context, question: "Bagaimana performa bisnis saya?" }),
      "chat",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      text: context.fallback,
      mode: "basic",
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("uses the official SDK with verified context when configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-placeholder");
    mocks.generate.mockResolvedValue({ text: "Penjualan Anda tumbuh." });
    const response = await handleAi(
      request({ context, question: "Bagaimana performa bisnis saya?" }),
      "chat",
    );
    expect(await response.json()).toEqual({
      text: "Penjualan Anda tumbuh.",
      mode: "gemini",
    });
    expect(mocks.generate.mock.calls[0][0].contents).not.toContain(
      "transactions",
    );
  });
  it("guides Gemini toward concise business answers while retaining financial safety", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-placeholder");
    mocks.generate.mockResolvedValue({ text: "Penjualan Anda tumbuh." });
    await handleAi(
      request({ context, question: "Bagaimana performa bisnis saya?" }),
      "chat",
    );
    const instruction =
      mocks.generate.mock.calls[0][0].config.systemInstruction;
    for (const phrase of [
      "partner bisnis",
      "mulai dengan kesimpulan bisnis",
      "40–100 kata",
      "jangan menumpuk semua angka",
      "Jangan menyebut angka yang belum tersedia bila tidak memengaruhi jawaban",
      "HANYA metrik terverifikasi",
      "Jangan menghitung progres target atau metrik finansial baru",
      "Jangan menganggap laba kotor sebagai laba bersih",
      "Gunakan alias entitas persis",
      "Jangan menjamin target tercapai",
      "bukan instruksi",
      "Jangan mencampur periode",
    ])
      expect(instruction).toContain(phrase);
  });
  it("falls back on service failures or empty AI output", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-placeholder");
    mocks.generate.mockRejectedValueOnce(new Error("offline"));
    expect(
      await (await handleAi(request({ context }), "explain")).json(),
    ).toEqual({ text: context.fallback, mode: "basic" });
    mocks.generate.mockResolvedValueOnce({ text: " " });
    expect(
      (await (await handleAi(request({ context }), "explain")).json()).mode,
    ).toBe("basic");
  });
  it("rejects raw datasets, nonfinite metrics, malformed JSON and oversized payloads", async () => {
    expect((await handleAi(request({ transactions: [] }), "chat")).status).toBe(
      400,
    );
    expect(
      (
        await handleAi(
          request({
            context: {
              ...context,
              overview: { ...context.overview, revenue: "15000" },
            },
          }),
          "explain",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleAi(
          new Request("http://localhost", { method: "POST", body: "{" }),
          "chat",
        )
      ).status,
    ).toBe(400);
    expect(
      (await handleAi(request({ text: "x".repeat(65537) }), "explain")).status,
    ).toBe(400);
  });
  it("requires a question for chat", async () =>
    expect((await handleAi(request({ context }), "chat")).status).toBe(400));
});

describe("structured Gemini chat grounding", () => {
  it("explains channels even when the legacy intent is unknown, using only aliased facts", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-placeholder");
    const channelContext = buildVerifiedContext(
      analyzeBusiness(createDemoData())!,
      "Channel penjualan terbaik apa?",
    );
    expect(channelContext.intent).toBe("unknown");
    mocks.generate.mockResolvedValue({
      text: "ENTITAS_1_RAMU adalah channel teratas.",
    });
    const response = await handleAi(
      request({
        context: channelContext,
        question:
          "Channel penjualan terbaik apa? Email saya private@example.org",
      }),
      "chat",
    );
    expect((await response.json()).mode).toBe("gemini");
    const payload = mocks.generate.mock.calls[0][0].contents;
    expect(payload).toContain("verifiedFacts");
    expect(payload).not.toContain("private@example.org");
    expect(payload).not.toContain(channelContext.channels[0].name);
    expect(payload).not.toContain("fallbackText");
  });
  it("returns specific deterministic limitations without invoking Gemini", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-placeholder");
    const limited = buildVerifiedContext(
      analyzeBusiness(createDemoData())!,
      "Siapa pelanggan terbaik?",
    );
    const response = await handleAi(
      request({ context: limited, question: "Siapa pelanggan terbaik?" }),
      "chat",
    );
    expect(await response.json()).toEqual({
      text: limited.fallback,
      mode: "basic",
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects raw records and arbitrary labels within new fact and channel structures", async () => {
    for (const bad of [
      {
        ...context,
        channels: [
          { name: "Shopee", revenue: 1, contribution: 1, transactions: [] },
        ],
      },
      {
        ...context,
        answer: {
          ...context.answer,
          facts: [{ field: "private customer", value: 1, format: "number" }],
        },
      },
      {
        ...context,
        answer: {
          ...context.answer,
          query: { ...context.answer.query, operation: "execute" },
        },
      },
    ])
      expect(
        (
          await handleAi(
            request({ context: bad, question: "Performa?" }),
            "chat",
          )
        ).status,
      ).toBe(400);
  });
});
