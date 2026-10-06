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
