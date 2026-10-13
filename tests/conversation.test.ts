import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generate };
  },
}));
import { analyzeBusiness } from "@/lib/analytics";
import { calculateGoal, type BusinessGoal } from "@/lib/goals";
import type { UploadedData } from "@/lib/types";
import {
  createChatSession,
  rememberTurn,
  emptyConversation,
} from "@/lib/chat/session";
import { preparePlan } from "@/lib/chat/planning";
import { retrievePlan } from "@/lib/chat/retrieval";
import { EntityRegistry, redactPrivateText } from "@/lib/chat/privacy";
import { registerImportedPrivacy } from "@/lib/chat/import-privacy";
import { requestChatTurn } from "@/lib/chat/client";
import { handlePlanner, handleConversation } from "@/lib/chat/server";
import {
  planSchema,
  conversationInputSchema,
  memorySchema,
  type BusinessQueryPlan,
  type InformationRequest,
} from "@/lib/chat/model";
import { renderGroundedReasoning } from "@/lib/chat/grounding";
import { prepareExplanationContext } from "@/lib/ai/chat-facts";
import { buildVerifiedContext } from "@/lib/insights";
import { formatRupiah } from "@/lib/utils";

const data: UploadedData = {
  transactions: [
    {
      date: "2026-08-20",
      orderId: "OLD-1938",
      productName: "Brownie",
      quantity: 10,
      unitPrice: 30000,
      discount: 0,
      channel: "Shopee",
    },
    {
      date: "2026-09-20",
      orderId: "INV-2026-003812",
      productName: "Brownie",
      quantity: 7,
      unitPrice: 60000,
      discount: 0,
      channel: "Shopee",
    },
    {
      date: "2026-09-20",
      orderId: "A001",
      productName: "Ladyfinger",
      quantity: 5,
      unitPrice: 62000,
      discount: 0,
      channel: "Tokopedia",
    },
    {
      date: "2026-09-20",
      orderId: "TXN-00293",
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
  expenses: [
    {
      date: "2026-09-20",
      category: "Rent",
      description: "calvin@example.com customer secret note",
      amount: 10000,
    },
  ],
  source: {
    kind: "upload",
    name: "Penjualan September.xlsx",
    loadedAt: "2026-10-13T00:00:00Z",
  },
};
const m = analyzeBusiness(data)!;
const goal: BusinessGoal = {
  id: "private-goal-id",
  metric: "revenue",
  period: "monthly",
  target: 2000000,
  enabled: true,
  createdAt: "2026-09-01T00:00:00Z",
};
const goals = [calculateGoal(goal, data, "2026-09-20")];
const makePlan = (
  requests: InformationRequest[],
  intent: BusinessQueryPlan["intent"] = "lookup",
): BusinessQueryPlan => ({
  requests,
  intent,
  responseGoal: intent === "lookup" ? "direct_answer" : "identify_focus",
  unsupported: [],
});
const channel = (
  operation: InformationRequest["operation"],
  entities: string[] = [],
  rank?: number,
): InformationRequest => ({
  topic: "channels",
  operation,
  entities,
  metric: "revenue",
  ...(rank ? { rank } : {}),
});
function transport() {
  const requests: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      requests.push({ url, body });
      return url.endsWith("/plan")
        ? handlePlanner(body)
        : handleConversation(body);
    }),
  );
  return requests;
}
function plannerThenReasoning(plan: BusinessQueryPlan) {
  mocks.generate.mockImplementation(async (request) => {
    const payload = JSON.parse(request.contents);
    if (!payload.snapshot) return { text: JSON.stringify(plan) };
    const entity = payload.snapshot.facts.find(
      (f: { entity?: string }) => f.entity,
    )?.entity;
    const revenue = payload.snapshot.facts.find(
      (f: { field: string; entity?: string }) =>
        f.field === "revenue" && f.entity === entity,
    );
    return {
      text: JSON.stringify({
        paragraphs: [
          entity && revenue
            ? `${entity} menyumbang penjualan {{${revenue.id}}}. Pertimbangkan menjaga ketersediaannya.`
            : "Saya bisa membantu membaca angka bisnis ini.",
        ],
      }),
    };
  });
}
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-placeholder");
  mocks.generate.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("private stable chat context", () => {
  it.each([
    ["Email saya calvin@example.com", "calvin@example.com", "[EMAIL]"],
    ["Hubungi 081234567890", "081234567890", "[PHONE]"],
    ["telepon 555 123 4567", "555 123 4567", "[PHONE]"],
    ["Hubungi 212-555-0123", "212-555-0123", "[PHONE]"],
    ["NIK 3174091234567890", "3174091234567890", "[PRIVATE_ID]"],
    ["Kartu 4111 1111 1111 1111", "4111 1111 1111 1111", "[PRIVATE_ID]"],
    ["Lihat https://example.com/customer/1", "example.com", "[URL]"],
    ["Invoice INV-2026-003812", "INV-2026-003812", "[ORDER_ID]"],
    ["Gunakan rahasia.csv", "rahasia.csv", "[FILE]"],
    ["Alamat saya Jalan Mawar 23, Jakarta", "Mawar", "[ADDRESS]"],
    ["Nama saya Calvin Raharjo; fokus ke mana?", "Calvin Raharjo", "[NAME]"],
    ["nama saya calvin raharjo; fokus ke mana?", "calvin raharjo", "[NAME]"],
  ])("redacts %s", (text, privateValue, placeholder) => {
    const result = redactPrivateText(text);
    expect(result).not.toContain(privateValue);
    expect(result).toContain(placeholder);
  });
  it("preserves natural intent, masks source-specific IDs and known customer names", () => {
    const local = {
      ...data,
      transactions: data.transactions.map((t) => ({
        ...t,
        customerName: "Siti Nurhaliza",
      })),
    };
    const registry = new EntityRegistry(local, m);
    const text = registry.sanitize(
      "Lebih baik fokus Brownie atau Shopee? Email calvin@example.com. Siti Nurhaliza, A001, Penjualan September.xlsx",
    );
    expect(text).toContain(
      "Lebih baik fokus PRODUCT_1_RAMU atau CHANNEL_1_RAMU?",
    );
    for (const value of [
      "Brownie",
      "Shopee",
      "calvin@example.com",
      "Siti Nurhaliza",
      "A001",
      "Penjualan September.xlsx",
    ])
      expect(text).not.toContain(value);
  });
  it("masks names from discarded import columns without altering financial records", () => {
    const imported = structuredClone(data),
      before = structuredClone(imported);
    registerImportedPrivacy(imported, {
      sheets: [
        {
          name: "Penjualan",
          columns: ["Nama Pelanggan"],
          rows: [
            { "Nama Pelanggan": "Siti Nurhaliza" },
            { "Nama Pelanggan": "王明" },
          ],
        },
      ],
    });
    const registry = new EntityRegistry(imported, m);
    expect(
      registry.sanitize("Apa yang bisa saya lihat untuk Siti Nurhaliza?"),
    ).not.toContain("Siti Nurhaliza");
    expect(registry.sanitize("Bagaimana 王明?")).not.toContain("王明");
    expect(imported).toEqual(before);
    expect(
      new EntityRegistry(structuredClone(data), m).sanitize("Siti Nurhaliza"),
    ).toBe("Siti Nurhaliza");
  });
  it("keeps aliases stable across order, repeated turns and goal edits", () => {
    const session = createChatSession(data, m);
    expect(session.registry.sanitize("Shopee dan Brownie")).toBe(
      "CHANNEL_1_RAMU dan PRODUCT_1_RAMU",
    );
    expect(session.registry.sanitize("Brownie dan Shopee")).toBe(
      "PRODUCT_1_RAMU dan CHANNEL_1_RAMU",
    );
    expect(session.registry.restore("CHANNEL_1_RAMU dan PRODUCT_1_RAMU")).toBe(
      "Shopee dan Brownie",
    );
    expect(session.registry.sanitize("brownie palsu")).toBe(
      "PRODUCT_1_RAMU palsu",
    );
  });
  it("does not alias substrings or leak longer overlapping entity names", () => {
    const metrics = {
      ...m,
      products: [...m.products, { ...m.products[0], name: "Fudgy Brownie" }],
    };
    const registry = new EntityRegistry(data, metrics);
    expect(registry.sanitize("Fudgy Brownie dan BrownieBites")).toMatch(
      /^PRODUCT_3_RAMU dan BrownieBites$/,
    );
  });
  it("keeps product/channel name collisions explicit and typed", () => {
    const metrics = {
      ...m,
      products: [...m.products, { ...m.products[0], name: "Shopee" }],
    };
    expect(
      new EntityRegistry(data, metrics).sanitize("Bandingkan Shopee"),
    ).toContain("PRODUCT_3_RAMU / CHANNEL_1_RAMU");
  });
  it("uses one product alias for source capitalization variants", () => {
    const registry = new EntityRegistry(
      {
        ...data,
        transactions: [
          ...data.transactions,
          { ...data.transactions[0], productName: "brownie" },
        ],
      },
      m,
    );
    expect(registry.sanitize("BROWNIE dan brownie")).toBe(
      "PRODUCT_1_RAMU dan PRODUCT_1_RAMU",
    );
  });
  it("does not confuse private entity names with unsupported query keywords", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    transport();
    const example = {
      ...data,
      transactions: data.transactions.map((t) => ({
        ...t,
        productName: "Customer Forecast Cake",
      })),
      products: [{ name: "Customer Forecast Cake", cogs: 20000 }],
    };
    const metrics = analyzeBusiness(example)!;
    const answer = await requestChatTurn(
      "Produk Customer Forecast Cake paling laris?",
      metrics,
      [],
      createChatSession(example, metrics),
    );
    expect(answer.text).toContain("Customer Forecast Cake");
    expect(answer.text).toContain("15 unit");
    expect(answer.text).not.toContain("data pelanggan");
  });
  it("aliases Unicode, emoji and flexible spaces without exposing real names", () => {
    const metrics = {
      ...m,
      products: [
        { ...m.products[0], name: "🍰 Fudgy Brownie" },
        { ...m.products[0], name: "Kopi Susu" },
      ],
    };
    const registry = new EntityRegistry(
      { ...data, products: [], transactions: [] },
      metrics,
    );
    expect(registry.sanitize("Fokus 🍰 Fudgy  Brownie atau Kopi   Susu?")).toBe(
      "Fokus PRODUCT_1_RAMU atau PRODUCT_2_RAMU?",
    );
  });
  it.each([
    "Apa artinya?\n```csv\ndate,order_id,quantity\n2026-09-20,A001,2\n```",
    'Bagaimana? [{"date":"2026-09-20","orderId":"A001","quantity":2}]',
    "Lihat\ndate,order_id,quantity\n2026-09-20,A001,2",
    "Apa artinya?\ndate,revenue\n2026-09-20,123000",
  ])("does not forward pasted raw records: %s", (text) => {
    const safe = redactPrivateText(text);
    expect(safe).toContain("[RAW_DATA]");
    expect(safe).not.toMatch(/order_id|orderId|A001|2026-09-20/);
  });
  it("bounds memory to six sanitized messages while visible history can be longer", () => {
    const session = createChatSession(data, m);
    const prepared = preparePlan(
      "Channel terbaik?",
      m,
      goals,
      session.registry,
      emptyConversation(),
    );
    const result = retrievePlan(prepared.fallback, m, goals, session.registry);
    let state = emptyConversation();
    for (let i = 0; i < 10; i++)
      state = rememberTurn(
        state,
        "Channel mana?",
        "CHANNEL_1_RAMU teratas.",
        prepared.fallback,
        result.snapshot,
      );
    expect(state.recentTurns).toHaveLength(6);
    expect(memorySchema.safeParse(state).success).toBe(true);
    expect(state.referencedEntities).toEqual(["CHANNEL_1_RAMU"]);
    expect(
      state.lastReferencedFacts.some((key) => key.includes("CHANNEL_1_RAMU")),
    ).toBe(true);
    expect(JSON.stringify(state)).not.toMatch(
      /transactions|orderId|Brownie|Shopee/,
    );
  });
  it("rejects arbitrary names/source identifiers disguised as fact-reference keys", () => {
    expect(
      memorySchema.safeParse({
        ...emptyConversation(),
        lastReferencedFacts: ["CalvinRaharjo"],
      }).success,
    ).toBe(false);
    expect(
      memorySchema.safeParse({
        ...emptyConversation(),
        lastReferencedFacts: ["OVERVIEW:orderId:A001"],
      }).success,
    ).toBe(false);
  });
  it("starts fresh even when replacement datasets have the same source timestamp", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    transport();
    const first = createChatSession(data, m);
    await requestChatTurn("Produk paling laris?", m, goals, first);
    const other = {
      ...data,
      transactions: data.transactions.map((t) => ({
        ...t,
        productName: "Kopi",
        channel: "Toko",
      })),
      products: [{ name: "Kopi", cogs: 1000 }],
    };
    const metrics = analyzeBusiness(other)!;
    const next = createChatSession(other, metrics);
    expect(next.id).not.toBe(first.id);
    expect(next.getSnapshot().memory).toEqual(emptyConversation());
    expect(next.getSnapshot().messages).toEqual([]);
    expect(next.registry.restore("PRODUCT_1_RAMU")).toBe("Kopi");
    await requestChatTurn("Produk paling laris?", metrics, [], next);
    expect(JSON.stringify(next.getSnapshot().memory)).not.toContain("Brownie");
  });
});

describe("hybrid query planning and fresh verified retrieval", () => {
  it("gives business overview enough aggregate context in a single reasoning call", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const requests = transport();
    await requestChatTurn(
      "Bagaimana performa bisnis saya?",
      m,
      goals,
      createChatSession(data, m),
    );
    expect(requests.map((r) => r.url)).toEqual(["/api/ai/chat"]);
    const last = requests[0].body as {
      snapshot: { facts: { topic: string }[] };
    };
    expect(new Set(last.snapshot.facts.map((f) => f.topic))).toEqual(
      new Set(["overview", "products", "channels", "goals", "trends"]),
    );
  });
  it("keeps a simple sales amount lookup narrow but plans a sales/orders combination", () => {
    const registry = new EntityRegistry(data, m);
    const lookup = preparePlan(
      "Berapa penjualan saya?",
      m,
      goals,
      registry,
      emptyConversation(),
    );
    expect(lookup.fallback.requests).toHaveLength(1);
    expect(lookup.fallback.requests[0].topic).toBe("revenue");
    expect(
      preparePlan(
        "Berapa penjualan dan pesanan saya?",
        m,
        goals,
        registry,
        emptyConversation(),
      ).needsPlanner,
    ).toBe(true);
  });
  it("keeps direct queries on the fast path with the sanitized question available to reasoning", async () => {
    const requests = transport();
    const session = createChatSession(data, m);
    mocks.generate.mockResolvedValue({
      text: JSON.stringify({
        paragraphs: [
          "CHANNEL_1_RAMU menjadi channel terbesar, dengan penjualan {{F1}}.",
        ],
      }),
    });
    const answer = await requestChatTurn(
      "Channel terbaik saya apa? Email saya calvin@example.com",
      m,
      goals,
      session,
    );
    expect(requests.map((r) => r.url)).toEqual(["/api/ai/chat"]);
    expect(answer.text).toContain("Shopee");
    expect(answer.mode).toBe("gemini");
    const payload = JSON.parse(mocks.generate.mock.calls[0][0].contents);
    expect(payload.question).toContain("[EMAIL]");
    expect(payload.snapshot.facts[0]).toMatchObject({
      entity: "CHANNEL_1_RAMU",
      value: 420000,
    });
  });
  it.each([
    "Apa yang paling penting dari bisnis saya sekarang?",
    "Kalau saya mau meningkatkan penjualan, fokus ke mana?",
    "Menurut kamu masalah terbesar saya apa?",
    "Ada peluang yang menarik?",
    "Apa yang sebaiknya saya lakukan untuk mengejar target?",
    "Kenapa performa saya seperti ini?",
  ])(
    "offers Gemini planning for %s rather than early clarification",
    async (question) => {
      const requests = transport();
      plannerThenReasoning(
        makePlan(
          [
            { topic: "overview", operation: "summary", entities: [] },
            {
              topic: "products",
              operation: "ranking",
              metric: "revenue",
              entities: [],
            },
            { topic: "channels", operation: "ranking", entities: [] },
            { topic: "goals", operation: "status", entities: [] },
            { topic: "warnings", operation: "summary", entities: [] },
            { topic: "trends", operation: "summary", entities: [] },
          ],
          "recommend",
        ),
      );
      const answer = await requestChatTurn(
        question,
        m,
        goals,
        createChatSession(data, m),
      );
      expect(requests.map((r) => r.url)).toEqual([
        "/api/ai/plan",
        "/api/ai/chat",
      ]);
      expect(answer.mode).toBe("gemini");
      const planning = JSON.parse(mocks.generate.mock.calls[0][0].contents);
      const reasoning = JSON.parse(mocks.generate.mock.calls[1][0].contents);
      expect(planning.question).toBe(question);
      expect(planning).not.toHaveProperty("snapshot");
      expect(
        reasoning.snapshot.facts.some(
          (f: { topic: string }) => f.topic === "products",
        ),
      ).toBe(true);
      expect(
        reasoning.snapshot.facts.some(
          (f: { topic: string }) => f.topic === "channels",
        ),
      ).toBe(true);
      expect(
        reasoning.snapshot.facts.some(
          (f: { topic: string }) => f.topic === "goals",
        ),
      ).toBe(true);
      expect(
        reasoning.snapshot.facts.some(
          (f: { topic: string }) => f.topic === "trends",
        ),
      ).toBe(true);
    },
  );
  it("maintains the top → second → comparison → reduce dependence channel conversation", async () => {
    transport();
    const session = createChatSession(data, m);
    const contents: unknown[] = [];
    mocks.generate.mockImplementation(async (request) => {
      const p = JSON.parse(request.contents);
      contents.push(p);
      if (!p.snapshot)
        return {
          text: JSON.stringify(
            makePlan(
              [
                channel(
                  p.question.includes("Bedanya") ? "compare" : "ranking",
                  p.question.includes("Bedanya")
                    ? ["CHANNEL_1_RAMU", "CHANNEL_2_RAMU"]
                    : [],
                ),
              ],
              "follow_up",
            ),
          ),
        };
      const refs = [
        ...new Set(p.snapshot.facts.map((f: { entity: string }) => f.entity)),
      ];
      return {
        text: JSON.stringify({
          paragraphs: [
            `${refs.join(" dan ")} dibahas dengan penjualan {{F1}}.`,
          ],
        }),
      };
    });
    const first = await requestChatTurn(
      "Channel terbaik saya apa?",
      m,
      goals,
      session,
    );
    const second = await requestChatTurn(
      "Kalau yang kedua?",
      m,
      goals,
      session,
    );
    const compare = await requestChatTurn("Bedanya jauh?", m, goals, session);
    const advice = await requestChatTurn(
      "Kalau saya ingin mengurangi ketergantungan ke yang pertama, apa yang bisa saya lakukan?",
      m,
      goals,
      session,
    );
    expect(first.text).toContain("Shopee");
    expect(second.text).toContain("Tokopedia");
    expect(compare.text).toContain("Shopee");
    expect(compare.text).toContain("Tokopedia");
    expect(advice.mode).toBe("gemini");
    const last = contents.at(-1) as {
      memory: { recentTurns: unknown[]; referencedEntities: string[] };
      snapshot: { facts: { entity: string; value: number }[] };
    };
    expect(last.memory.recentTurns).toHaveLength(6);
    expect(last.memory.referencedEntities).toEqual([
      "CHANNEL_1_RAMU",
      "CHANNEL_2_RAMU",
    ]);
    expect(
      last.snapshot.facts.find((f) => f.entity === "CHANNEL_1_RAMU")?.value,
    ).toBe(420000);
  });
  it("retrieves profit for the product discussed in the previous turn", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const requests = transport();
    const session = createChatSession(data, m);
    await requestChatTurn("Produk paling laris?", m, goals, session);
    const answer = await requestChatTurn(
      "Kalau dari sisi keuntungan?",
      m,
      goals,
      session,
    );
    const last = requests.at(-1)!.body as {
      snapshot: {
        facts: { field: string; entity: string; value: number | null }[];
      };
      plan: BusinessQueryPlan;
    };
    expect(last.plan.requests[0]).toMatchObject({
      topic: "products",
      metric: "grossProfit",
      entities: ["PRODUCT_1_RAMU"],
    });
    expect(
      last.snapshot.facts.find((f) => f.field === "grossProfit")?.value,
    ).toBe(490000);
    expect(answer.text).toContain(formatRupiah(490000));
  });
  it("keeps the capitalized comparison follow-up scoped to both channels without Gemini", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    transport();
    const session = createChatSession(data, m);
    await requestChatTurn("Channel terbaik saya apa?", m, goals, session);
    await requestChatTurn("Kalau yang kedua?", m, goals, session);
    const result = await requestChatTurn("Bedanya jauh?", m, goals, session);
    expect(result.text).toContain("Shopee");
    expect(result.text).toContain("Tokopedia");
    expect(session.getSnapshot().memory.lastPlan?.requests[0]).toMatchObject({
      topic: "channels",
      operation: "compare",
      entities: ["CHANNEL_1_RAMU", "CHANNEL_2_RAMU"],
    });
  });
  it("retains analytical focus through an unsupported detour", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    transport();
    const session = createChatSession(data, m);
    await requestChatTurn("Produk paling laris?", m, goals, session);
    await requestChatTurn("Siapa pelanggan terbaik?", m, goals, session);
    const result = await requestChatTurn(
      "Kalau dari sisi keuntungan?",
      m,
      goals,
      session,
    );
    expect(result.text).toContain("Brownie");
    expect(result.text).toContain(formatRupiah(490000));
  });
  it("answers the supported part of a customer + bestseller question without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    transport();
    const answer = await requestChatTurn(
      "Apa pelanggan terbaik dan produk paling laris?",
      m,
      goals,
      createChatSession(data, m),
    );
    expect(answer.mode).toBe("basic");
    expect(answer.text).toContain("data pelanggan");
    expect(answer.text).toContain("Brownie");
    expect(answer.text).toContain("10 unit");
  });
  it("preserves core financial numbers and historical goal periods", () => {
    const registry = new EntityRegistry(data, m);
    const prepared = preparePlan(
      "Apa fokus saya untuk mengejar target?",
      m,
      goals,
      registry,
      emptyConversation(),
    );
    const { snapshot } = retrievePlan(prepared.fallback, m, goals, registry);
    expect(
      snapshot.facts.find((f) => f.field === "revenue" && !f.entity)?.value,
    ).toBe(m.revenue);
    expect(
      snapshot.facts.find((f) => f.field === "grossProfit" && !f.entity)?.value,
    ).toBe(m.grossProfit);
    expect(
      snapshot.facts.find((f) => f.field === "actual")?.goal,
    ).toMatchObject({
      start: "2026-09-01",
      end: "2026-09-30",
      referenceDate: "2026-09-20",
    });
    expect(snapshot.facts.find((f) => f.field === "requiredPace")?.value).toBe(
      goals[0].requiredRemainingPace,
    );
  });
  it("ranks across all active goals before bounding the provider snapshot", () => {
    const progress = [
      calculateGoal(
        { ...goal, id: "revenue-month", target: 1100000 },
        data,
        "2026-09-20",
      ),
      calculateGoal(
        { ...goal, id: "orders-month", metric: "orders", target: 4 },
        data,
        "2026-09-20",
      ),
      calculateGoal(
        { ...goal, id: "units-month", metric: "units", target: 16 },
        data,
        "2026-09-20",
      ),
      calculateGoal(
        { ...goal, id: "revenue-year", period: "yearly", target: 50000000 },
        data,
        "2026-09-20",
      ),
    ];
    const registry = new EntityRegistry(data, m);
    const result = retrievePlan(
      makePlan([{ topic: "goals", operation: "bottom", entities: [] }]),
      m,
      progress,
      registry,
    );
    expect(result.snapshot.facts.find((f) => f.field === "target")?.value).toBe(
      50000000,
    );
    expect(
      result.snapshot.facts.find((f) => f.field === "actual")?.goal?.period,
    ).toBe("yearly");
  });
  it("does not treat net profit or unsupported trend metrics as revenue/gross profit", () => {
    const registry = new EntityRegistry(data, m);
    const { snapshot } = retrievePlan(
      makePlan([
        {
          topic: "profit",
          metric: "netProfit",
          operation: "summary",
          entities: [],
        },
        {
          topic: "trends",
          metric: "grossProfit",
          operation: "summary",
          entities: [],
        },
      ]),
      m,
      goals,
      registry,
    );
    expect(snapshot.facts).toEqual([]);
    expect(snapshot.results.every((r) => r.status === "unavailable")).toBe(
      true,
    );
  });
});

describe("provider payload and model output safety", () => {
  it("also aliases existing Dashboard/goal summaries without modifying closed metric labels", () => {
    const context = buildVerifiedContext(m, "Bagaimana target saya?", goals);
    const prepared = prepareExplanationContext(context);
    const payload = JSON.stringify(prepared.payload);
    expect(payload).not.toMatch(
      /Brownie|Ladyfinger|Shopee|Tokopedia|calvin@example|Penjualan September/,
    );
    expect(payload).toContain("PRODUCT_1_RAMU");
    expect(payload).toContain('"metric":"revenue"');
    expect(prepared.restore("PRODUCT_1_RAMU")).toBe("Brownie");
  });
  it("inspects both actual SDK payloads for names, PII, source metadata and raw rows", async () => {
    transport();
    plannerThenReasoning(
      makePlan(
        [
          {
            topic: "products",
            operation: "summary",
            metric: "revenue",
            entities: ["PRODUCT_1_RAMU"],
          },
          {
            topic: "channels",
            operation: "summary",
            entities: ["CHANNEL_1_RAMU"],
          },
        ],
        "recommend",
      ),
    );
    const session = createChatSession(data, m);
    await requestChatTurn(
      "Bandingkan Brownie dan Shopee. Email saya calvin@example.com, 081234567890, INV-2026-003812, Penjualan September.xlsx",
      m,
      goals,
      session,
    );
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    for (const call of mocks.generate.mock.calls) {
      const payload = call[0].contents;
      for (const forbidden of [
        "transactions",
        "orderId",
        "customer secret note",
        "calvin@example.com",
        "081234567890",
        "INV-2026-003812",
        "Penjualan September.xlsx",
        "Brownie",
        "Ladyfinger",
        "Shopee",
        "Tokopedia",
        "Offline",
      ])
        expect(payload).not.toContain(forbidden);
      expect(payload).toContain("PRODUCT_1_RAMU");
      expect(payload).toContain("CHANNEL_1_RAMU");
      expect(payload).toContain("[EMAIL]");
    }
    const reasoning = JSON.parse(mocks.generate.mock.calls[1][0].contents);
    expect(reasoning).not.toHaveProperty("fallback");
  });
  it("never sends restored history back to Gemini", async () => {
    transport();
    const session = createChatSession(data, m);
    mocks.generate.mockResolvedValue({
      text: JSON.stringify({
        paragraphs: ["PRODUCT_1_RAMU terjual {{F3}} unit."],
      }),
    });
    await requestChatTurn("Produk paling laris?", m, goals, session);
    plannerThenReasoning(
      makePlan(
        [
          {
            topic: "products",
            operation: "summary",
            metric: "margin",
            entities: ["PRODUCT_1_RAMU"],
          },
        ],
        "follow_up",
      ),
    );
    await requestChatTurn("Kalau dari sisi margin?", m, goals, session);
    for (const call of mocks.generate.mock.calls)
      expect(call[0].contents).not.toMatch(/Brownie|Ladyfinger|Shopee/);
    expect(JSON.stringify(session.getSnapshot().memory.recentTurns)).toContain(
      "PRODUCT_1_RAMU",
    );
  });
  it("rejects planner financial fields, arbitrary entities and incompatible entity types", async () => {
    const session = createChatSession(data, m);
    const prepared = preparePlan(
      "Fokus ke mana?",
      m,
      goals,
      session.registry,
      emptyConversation(),
    );
    for (const candidate of [
      { ...makePlan([channel("top")]), revenue: 999999 },
      makePlan([channel("top", ["CHANNEL_999_RAMU"])]),
      makePlan([channel("compare", ["PRODUCT_1_RAMU"])]),
    ]) {
      mocks.generate.mockResolvedValue({ text: JSON.stringify(candidate) });
      expect((await (await handlePlanner(prepared.planner)).json()).mode).toBe(
        "basic",
      );
    }
    expect(
      planSchema.safeParse({ ...makePlan([]), requestedRevenue: 10 }).success,
    ).toBe(false);
  });
  it("rejects raw arrays and unexpected fields before calling the provider", async () => {
    const session = createChatSession(data, m);
    const prepared = preparePlan(
      "Produk paling laris?",
      m,
      goals,
      session.registry,
      emptyConversation(),
    );
    const { snapshot, fallback } = retrievePlan(
      prepared.fallback,
      m,
      goals,
      session.registry,
    );
    const input = {
      kind: "conversation",
      ...prepared.planner,
      plan: prepared.fallback,
      snapshot,
      fallback: session.registry.sanitize(fallback),
    };
    const { availableTopics: ignored, ...chat } = input;
    void ignored;
    for (const value of [
      { ...chat, transactions: data.transactions },
      { ...chat, snapshot: { ...snapshot, orderId: "A001" } },
      {
        ...chat,
        snapshot: {
          ...snapshot,
          facts: [{ ...snapshot.facts[0], entity: "Brownie" }],
        },
      },
    ])
      expect((await handleConversation(value)).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(conversationInputSchema.safeParse(chat).success).toBe(true);
  });
  it.each([
    "PRODUCT_1_RAMU menghasilkan Rp999.999.",
    "Penjualan naik sepuluh persen.",
    "Penjualan dua puluh juta rupiah.",
    "Penjualan puluhan juta rupiah.",
    "Penjualan {{F999}}.",
    "PRODUCT_999_RAMU menghasilkan {{F1}}.",
    "Hubungi private@example.org.",
  ])("rejects ungrounded/private output: %s", async (text) => {
    transport();
    mocks.generate.mockResolvedValue({
      text: JSON.stringify({ paragraphs: [text] }),
    });
    const answer = await requestChatTurn(
      "Produk paling laris?",
      m,
      goals,
      createChatSession(data, m),
    );
    expect(answer.mode).toBe("basic");
    expect(answer.text).not.toContain("999.999");
    expect(answer.text).not.toContain("private@example.org");
  });
  it("renders verified numeric tokens and never converts unavailable facts to zero", () => {
    const session = createChatSession(data, m);
    const prepared = preparePlan(
      "Berapa omzet?",
      m,
      goals,
      session.registry,
      emptyConversation(),
    );
    const { snapshot } = retrievePlan(
      prepared.fallback,
      m,
      goals,
      session.registry,
    );
    expect(
      renderGroundedReasoning(
        { paragraphs: ["Penjualan {{F1}} pada {{PERIOD}}."] },
        snapshot,
        session.registry.catalog(),
      ),
    ).toContain(formatRupiah(m.revenue));
    expect(() =>
      renderGroundedReasoning(
        { paragraphs: ["Penjualan {{F1}}."] },
        {
          ...snapshot,
          facts: snapshot.facts.map((f) => ({ ...f, value: null })),
        },
        session.registry.catalog(),
      ),
    ).toThrow();
  });
  it("retains deterministic answers through planner and reasoning failures", async () => {
    transport();
    mocks.generate.mockRejectedValue(new Error("private@example.org secret"));
    const answer = await requestChatTurn(
      "Kalau mau meningkatkan penjualan, fokus ke mana?",
      m,
      goals,
      createChatSession(data, m),
    );
    expect(answer.mode).toBe("basic");
    expect(answer.text).toContain("analisis lanjutan");
    expect(answer.text).toContain(formatRupiah(m.revenue));
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "private@example.org",
    );
  });
});
