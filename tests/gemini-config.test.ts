import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generate };
  },
}));

import { createDemoData } from "@/lib/demo";
import { analyzeBusiness } from "@/lib/analytics";
import { buildVerifiedContext } from "@/lib/insights";

const routes = ["chat", "explain", "goals", "map-data"] as const;
type Route = (typeof routes)[number];
const context = buildVerifiedContext(analyzeBusiness(createDemoData())!);
const schema = {
  sheets: [
    {
      id: "0",
      name: "Penjualan",
      columns: [
        { name: "Tanggal", inferredType: "date" },
        { name: "Total", inferredType: "number" },
      ],
    },
  ],
};
const mappingResponse = {
  sheets: [
    {
      id: "0",
      sheetType: "transactions",
      mapping: [
        { source: "Tanggal", target: "date", confidence: 1 },
        { source: "Total", target: "revenue", confidence: 1 },
      ],
    },
  ],
};

async function callRoute(route: Route) {
  const handlers = {
    chat: () => import("@/app/api/ai/chat/route"),
    explain: () => import("@/app/api/ai/explain/route"),
    goals: () => import("@/app/api/ai/goals/route"),
    "map-data": () => import("@/app/api/ai/map-data/route"),
  };
  const { POST } = await handlers[route]();
  return POST(
    new Request(`http://localhost/api/ai/${route}`, {
      method: "POST",
      body: JSON.stringify(
        route === "map-data"
          ? schema
          : { context, question: "Bagaimana performa bisnis saya?" },
      ),
    }),
  );
}

beforeEach(() => {
  vi.resetModules();
  mocks.generate.mockReset();
  vi.stubEnv("GEMINI_API_KEY", "test-only-placeholder");
  vi.stubEnv("GEMINI_MODEL", undefined);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each([
  [undefined, "gemini-3.5-flash-lite"],
  ["configured-test-model", "configured-test-model"],
] as const)("shared Gemini model (%s)", (override, model) => {
  it.each(routes)("uses the configured model for /api/ai/%s", async (route) => {
    vi.stubEnv("GEMINI_MODEL", override);
    mocks.generate.mockResolvedValue({
      text:
        route === "map-data"
          ? JSON.stringify(mappingResponse)
          : "Penjualan Anda tumbuh.",
    });
    const response = await callRoute(route);
    expect(response.status).toBe(200);
    expect((await response.json()).mode).toBe("gemini");
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({ model }),
    );
    expect(console.info).toHaveBeenCalledWith("[RAMU Gemini]", {
      route: `/api/ai/${route}`,
      model,
      keyConfigured: true,
    });
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("safe Gemini diagnostics and unchanged fallback", () => {
  it.each(routes)("reports missing key safely for /api/ai/%s", async (route) => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await (await callRoute(route)).json()).mode).toBe("basic");
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith("[RAMU Gemini]", {
      route: `/api/ai/${route}`,
      model: "gemini-3.5-flash-lite",
      keyConfigured: false,
    });
  });

  it.each(routes)("logs access failure safely for /api/ai/%s", async (route) => {
    const privateDetails =
      "test-only-placeholder Authorization: Bearer secret customer@example.org uploaded-row-123";
    mocks.generate.mockRejectedValue(
      Object.assign(new Error(privateDetails), {
        status: 403,
        headers: { authorization: privateDetails },
        response: { data: privateDetails },
      }),
    );
    expect((await (await callRoute(route)).json()).mode).toBe("basic");
    expect(console.error).toHaveBeenCalledWith("[RAMU Gemini Error]", {
      route: `/api/ai/${route}`,
      model: "gemini-3.5-flash-lite",
      message: "Gemini authentication or project access was denied.",
      status: 403,
    });
    const logs = JSON.stringify([
      vi.mocked(console.info).mock.calls,
      vi.mocked(console.error).mock.calls,
    ]);
    for (const value of privateDetails.split(" "))
      expect(logs).not.toContain(value);
  });

  it("logs a known DNS code without logging the cause or key", async () => {
    mocks.generate.mockRejectedValue(
      new Error("test-only-placeholder", {
        cause: { code: "EAI_AGAIN", hostname: "private-hostname" },
      }),
    );
    expect((await (await callRoute("chat")).json()).mode).toBe("basic");
    expect(console.error).toHaveBeenCalledWith("[RAMU Gemini Error]", {
      route: "/api/ai/chat",
      model: "gemini-3.5-flash-lite",
      message: "Gemini request failed.",
      code: "EAI_AGAIN",
    });
  });

  it.each(["explain", "map-data"] as const)(
    "logs empty or invalid output safely for /api/ai/%s",
    async (route) => {
      mocks.generate.mockResolvedValue({
        text: route === "map-data" ? "customer@example.org" : " ",
      });
      expect((await (await callRoute(route)).json()).mode).toBe("basic");
      expect(console.error).toHaveBeenCalledWith("[RAMU Gemini Error]", {
        route: `/api/ai/${route}`,
        model: "gemini-3.5-flash-lite",
        message: "Gemini response was empty or invalid.",
      });
    },
  );
});
