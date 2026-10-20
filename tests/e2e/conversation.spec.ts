import { expect, test, type Page } from "@playwright/test";
import { analyzeBusiness, getTopSellingProduct } from "../../lib/analytics";
import { createDemoData } from "../../lib/demo";
import { channelPerformance } from "../../lib/queries/aggregates";
import { formatRupiah } from "../../lib/utils";
import type {
  BusinessQueryPlan,
  ConversationInput,
  PlannerInput,
} from "../../lib/chat/model";

const navigate = (page: Page, name: string) =>
  page.getByRole("navigation").getByRole("link", { name, exact: true }).click();
const send = async (page: Page, question: string) => {
  await page.getByLabel("Pertanyaan untuk RAMU").fill(question);
  await page.getByRole("button", { name: "Kirim pertanyaan" }).click();
  await expect(page.getByLabel("Pertanyaan untuk RAMU")).toBeEnabled();
  return page.locator(".chat-message.assistant").last();
};
async function demo(page: Page) {
  await page.goto("/data");
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await navigate(page, "Tanya RAMU");
}

test("session conversation survives navigation and resolves channel/product follow-ups without Gemini", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await demo(page);
  const metrics = analyzeBusiness(createDemoData())!;
  const channels = channelPerformance(metrics).filter(
    (c) => c.name !== "Tanpa kanal",
  );
  await expect(await send(page, "Channel terbaik saya apa?")).toContainText(
    channels[0].name,
  );
  await expect(await send(page, "Kalau yang kedua?")).toContainText(
    channels[1].name,
  );
  const comparison = await send(page, "Bedanya jauh?");
  await expect(comparison).toContainText(channels[0].name);
  await expect(comparison).toContainText(channels[1].name);
  await expect(comparison).toContainText(formatRupiah(channels[0].revenue));
  const advice = await send(
    page,
    "Kalau saya ingin mengurangi ketergantungan ke yang pertama, apa yang bisa saya lakukan?",
  );
  await expect(advice).toContainText(channels[0].name);
  await expect(advice).not.toContainText(
    "Apa yang ingin Anda lihat lebih dekat",
  );
  await navigate(page, "Dashboard");
  await navigate(page, "Tanya RAMU");
  await expect(page.locator(".chat-message.user")).toHaveCount(4);
  const product = getTopSellingProduct(metrics)!;
  await expect(await send(page, "Produk paling laris?")).toContainText(
    product.name,
  );
  await expect(await send(page, "Kalau dari sisi keuntungan?")).toContainText(
    formatRupiah(product.grossProfit!),
  );
  await expect(page.locator(".message-mode").last()).toHaveText(
    "Analisis dasar",
  );
  await expect(page.locator(".chat-data-assurance")).toContainText(
    "transaksi mentah tidak dikirim",
  );
  expect(errors).toEqual([]);
});

test("open-ended turns plan over sanitized context and restore local entity names", async ({
  page,
}) => {
  const planning: PlannerInput[] = [],
    reasoning: ConversationInput[] = [];
  await page.route("**/api/ai/plan", async (route) => {
    const body = route.request().postDataJSON() as PlannerInput;
    planning.push(body);
    const plan: BusinessQueryPlan = {
      intent: "recommend",
      responseGoal: "identify_focus",
      unsupported: [],
      requests: [
        {
          topic: "products",
          operation: "ranking",
          metric: "revenue",
          entities: [],
        },
        {
          topic: "channels",
          operation: "ranking",
          metric: "revenue",
          entities: [],
        },
        { topic: "overview", operation: "summary", entities: [] },
      ],
    };
    await route.fulfill({ json: { plan, mode: "gemini" } });
  });
  await page.route("**/api/ai/chat", async (route) => {
    const body = route.request().postDataJSON() as ConversationInput;
    reasoning.push(body);
    const fact = body.snapshot.facts.find(
      (f) => f.entity?.startsWith("PRODUCT_") && f.field === "revenue",
    )!;
    await route.fulfill({
      json: {
        text: `${fact.entity} menyumbang penjualan ${formatRupiah(fact.value!)}. Coba tawarkan bersama produk lain.`,
        mode: "gemini",
      },
    });
  });
  await demo(page);
  const top = analyzeBusiness(createDemoData())!.products[0];
  const answer = await send(
    page,
    `Kalau saya mau meningkatkan penjualan, fokus ke ${top.name} atau Shopee? Email saya calvin@example.com, 081234567890.`,
  );
  await expect(answer).toContainText(top.name);
  await expect(answer).not.toContainText("PRODUCT_");
  await expect(page.locator(".message-mode")).toHaveText("Dibantu AI");
  await send(page, "Kenapa?");
  expect(planning).toHaveLength(2);
  expect(planning[1].memory.recentTurns).toHaveLength(2);
  expect(JSON.stringify(planning[1].memory.recentTurns)).toContain(
    "PRODUCT_1_RAMU",
  );
  for (const payload of [...planning, ...reasoning]) {
    const text = JSON.stringify(payload);
    expect(text).not.toContain(top.name);
    expect(text).not.toContain("Shopee");
    expect(text).not.toContain("calvin@example.com");
    expect(text).not.toContain("081234567890");
    expect(text).not.toContain("orderId");
    expect(text).not.toContain("transactions");
  }
});

test("replacing data resets memory/aliases and an old pending answer cannot enter the new session", async ({
  page,
}) => {
  let release: () => void = () => {};
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let count = 0;
  const bodies: ConversationInput[] = [];
  await page.route("**/api/ai/chat", async (route) => {
    const body = route.request().postDataJSON() as ConversationInput;
    bodies.push(body);
    count++;
    if (count === 1) await delayed;
    const fact = body.snapshot.facts.find(
      (f) => f.entity?.startsWith("PRODUCT_") && f.field === "revenue",
    )!;
    await route.fulfill({
      json: {
        text: `${fact.entity} menghasilkan penjualan ${formatRupiah(fact.value!)}.`,
        mode: "gemini",
      },
    });
  });
  await demo(page);
  await page.getByLabel("Pertanyaan untuk RAMU").fill("Produk paling laris?");
  await page.getByRole("button", { name: "Kirim pertanyaan" }).click();
  await expect.poll(() => bodies.length).toBe(1);
  await navigate(page, "Data Bisnis");
  await page.getByRole("button", { name: "Ganti Data", exact: true }).click();
  await page.getByTestId("file-input").setInputFiles({
    name: "kopi.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "date,order_id,product_name,quantity,unit_price,channel,nama_pelanggan\n2026-09-20,NEW001,Kopi,2,50000,Toko,Siti Nurhaliza",
    ),
  });
  await expect(page).toHaveURL(/\/dashboard$/);
  await navigate(page, "Tanya RAMU");
  await expect(page.locator(".chat-message")).toHaveCount(0);
  release();
  const answer = await send(page, "Produk paling laris? Siti Nurhaliza");
  await expect(answer).toContainText("Kopi");
  await expect(answer).not.toContainText("Brownie");
  expect(bodies[1].memory.recentTurns).toEqual([]);
  expect(JSON.stringify(bodies[1])).not.toContain("Siti Nurhaliza");
  expect(
    bodies[1].snapshot.facts.find((f) => f.field === "revenue")?.entity,
  ).toBe("PRODUCT_1_RAMU");
  await expect(page.locator(".chat-message.user")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Belum ada data bisnis" }),
  ).toBeVisible();
});
