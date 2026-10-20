import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import type { ConversationInput } from "../../lib/chat/model";
const navigate = (page: Page, name: string) =>
  page.getByRole("navigation").getByRole("link", { name, exact: true }).click();
const upload = (page: Page, text: string, name = "Penjualan.csv") =>
  page
    .getByTestId("file-input")
    .setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(text) });
for (const [label, width, height] of [
  ["desktop", 1440, 900],
  ["tablet", 820, 1050],
  ["mobile", 390, 844],
] as const) {
  test(`recognizable upload leads directly to a decision-first dashboard on ${label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [],
      mappingCalls: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    page.on("request", (r) => {
      if (r.url().includes("/api/ai/map-data")) mappingCalls.push(r.url());
    });
    await page.goto("/data");
    await upload(
      page,
      "Tanggal,Pendapatan,No Invoice,Produk,Qty,Harga,channel,cogs\n2026-09-19,200000,A,Roti,2,100000,Toko,20000\n2026-09-20,100000,B,Roti,1,100000,Toko,20000",
    );
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeFocused();
    await expect(page.locator(".processed-confirmation")).toContainText(
      "Data berhasil diproses",
    );
    await expect(page.locator(".processed-confirmation")).toContainText(
      "Penjualan.csv",
    );
    await expect(page.locator(".kpi-card").first()).toContainText("Rp100.000");
    await expect(page.locator(".decision-priority")).toContainText(
      "Penjualan sedang turun",
    );
    await expect(page.locator(".decision-next-step")).toContainText("Tinjau");
    await expect(
      page.locator(".mapping-review, .import-clarification"),
    ).toHaveCount(0);
    const priority = await page.locator(".decision-priority").boundingBox(),
      chart = await page.locator(".revenue-panel").boundingBox();
    expect(priority!.y).toBeLessThan(chart!.y);
    if (label === "desktop")
      expect(priority!.y + priority!.height).toBeLessThan(height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/ramu-decision-${label}.png`,
      fullPage: true,
    });
    await navigate(page, "Data Bisnis");
    await expect(page.locator(".active-filename")).toHaveText("Penjualan.csv");
    await page.getByRole("button", { name: "Lihat Mapping" }).click();
    await expect(
      page.getByRole("heading", { name: "Cara RAMU membaca data" }),
    ).toBeFocused();
    await expect(page.locator(".mapping-summary")).toContainText("Pendapatan");
    expect(mappingCalls).toEqual([]);
    expect(errors).toEqual([]);
  });
}
test("an ambiguous sales total asks one accessible question before activating data", async ({
  page,
}) => {
  await page.goto("/data");
  await upload(
    page,
    "Tanggal,Revenue,Total Sales\n2026-09-20,120000,999000",
    "ambigu.csv",
  );
  await expect(page).toHaveURL(/\/data$/);
  await expect(
    page.getByRole("heading", {
      name: "Kami perlu memastikan satu hal tentang file Anda.",
    }),
  ).toBeFocused();
  await expect(page.locator(".import-question")).toContainText("dua kolom");
  await expect(page.locator(".mapping-review")).not.toBeVisible();
  await page.getByLabel(/Ada dua kolom/).selectOption("Revenue");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".kpi-card").first()).toContainText("Rp120.000");
  await expect(page.locator(".kpi-card")).toHaveCount(1);
});
test("a missing date is corrected without selecting the file again", async ({
  page,
}) => {
  await page.goto("/data");
  await upload(page, "Kapan,Pendapatan\n2026-09-20,130000");
  await page
    .getByLabel("Kolom mana yang menunjukkan tanggal transaksi?")
    .selectOption("Kapan");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".kpi-card").first()).toContainText("Rp130.000");
});
test("invalid replacement and cancelling correction preserve the active dataset", async ({
  page,
}) => {
  await page.goto("/data");
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  const original = await page.locator(".active-filename").innerText();
  await page.getByRole("button", { name: "Ganti Data", exact: true }).click();
  await upload(page, "Tanggal,Pendapatan\n2026-02-30,100");
  await expect(
    page.locator(".import-clarification [role=alert]"),
  ).toContainText("tanggal tidak valid");
  await expect(page.locator(".active-filename")).toHaveText(original);
  await page.getByRole("button", { name: "Batal memproses file" }).click();
  await expect(
    page.getByRole("heading", { name: "Ganti Data Bisnis" }),
  ).toBeFocused();
  await expect(page.locator(".active-filename")).toHaveText(original);
  await upload(page, "Tanggal,Pendapatan\n2026-09-20,140000", "baru.csv");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".kpi-card").first()).toContainText("Rp140.000");
});
for (const manual of [false, true]) {
  test(`import privacy registration and customer-name redaction work in ${manual ? "manual" : "automatic"} path`, async ({
    page,
  }) => {
    let body: ConversationInput | undefined;
    await page.route("**/api/ai/chat", async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({ json: { text: body!.fallback, mode: "basic" } });
    });
    await page.goto("/data");
    if (manual) {
      await page.locator(".manual-upload-option > summary").click();
      await page.getByLabel("Tinjau kolom sebelum data diaktifkan").check();
    }
    await upload(
      page,
      "date,revenue,product_name,quantity,channel,nama_pelanggan,email\n2026-09-20,150000,Roti,1,Toko,Siti Nurhaliza,private@example.com",
      "privat.csv",
    );
    if (manual)
      await page
        .getByRole("button", { name: "Konfirmasi & Analisis Data" })
        .click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await navigate(page, "Tanya RAMU");
    await page
      .getByLabel("Pertanyaan untuk RAMU")
      .fill("Produk paling laris? Siti Nurhaliza private@example.com");
    await page.getByRole("button", { name: "Kirim pertanyaan" }).click();
    await expect(page.locator(".chat-message.assistant")).toContainText("Roti");
    expect(JSON.stringify(body)).not.toMatch(
      /Siti Nurhaliza|private@example|privat.csv|"Roti"|"Toko"/,
    );
    expect(body!.catalog.some((c) => c.entity === "PRODUCT_1_RAMU")).toBe(true);
  });
}
test("clear expenses import automatically without silently claiming complete coverage", async ({
  page,
}) => {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries({
    Transactions: [
      {
        date: "2026-09-20",
        product_name: "Roti",
        quantity: 2,
        unit_price: 100000,
        cogs: 20000,
      },
    ],
    Expenses: [{ date: "2026-09-20", category: "Sewa", amount: 10000 }],
  }))
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name);
  await page.goto("/data");
  await page.getByTestId("file-input").setInputFiles({
    name: "lengkap.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
  });
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".kpi-card").last()).toContainText("Rp160.000");
  await navigate(page, "Data Bisnis");
  await expect(page.locator(".capability-explanations")).toContainText(
    "Pengeluaran sudah terbaca, tetapi belum dikonfirmasi lengkap",
  );
  await page.getByRole("button", { name: "Ganti Data", exact: true }).click();
  await page.locator(".manual-upload-option > summary").click();
  await page.getByLabel("Tinjau kolom sebelum data diaktifkan").check();
  await page
    .getByTestId("file-input")
    .setInputFiles({
      name: "lengkap.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
    });
  await page.getByLabel(/^Data biaya operasional lengkap/).check();
  await page
    .getByRole("button", { name: "Konfirmasi & Analisis Data" })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await navigate(page, "Data Bisnis");
  await expect(
    page.locator(".capability-statuses li").filter({ hasText: "Pengeluaran" }),
  ).toContainText("Tersedia");
});
