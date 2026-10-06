import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { readFile } from "node:fs/promises";
import { analyzeBusiness } from "../../lib/analytics";
import { createDemoData } from "../../lib/demo";
import { formatRupiah } from "../../lib/utils";

test.beforeEach(async ({ page }) => {
  await page.goto("/dashboard");
});

test("demo dashboard, charts, product rankings, insights and fallback chat", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const metrics = analyzeBusiness(createDemoData())!;
  await expect(
    page.getByRole("heading", { name: "Belum ada data bisnis" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await expect(
    page.getByText(formatRupiah(metrics.revenue), { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(formatRupiah(metrics.grossProfit!), { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tren Pendapatan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Pendapatan bulanan/ }),
  ).toBeVisible();
  await expect(page.locator(".insight-card").nth(1)).toBeVisible();
  expect(await page.locator(".insight-card").count()).toBeLessThanOrEqual(4);
  await expect(page.locator(".product-table tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "Lihat semua" }).click();
  await expect(page.locator(".product-table tbody tr")).toHaveCount(6);
  await page.getByLabel("Agregasi grafik").selectOption("week");
  await expect(
    page.getByRole("img", { name: /Pendapatan mingguan/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Jelaskan dengan RAMU" }).click();
  await expect(page.locator(".ai-explanation")).toContainText(
    "Penjelasan RAMU",
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Tanya RAMU" })
    .click();
  await page
    .getByRole("button", { name: "Produk apa yang paling laris?" })
    .click();
  await expect(page.locator(".chat-message.assistant")).toContainText(
    "Produk paling laris adalah",
  );
  await expect(page.locator(".chat-fallback-notice")).toBeVisible();
  await page
    .getByLabel("Pertanyaan untuk RAMU")
    .fill("Siapa pelanggan terbaik?");
  await page.getByRole("button", { name: "Kirim pertanyaan" }).click();
  await expect(page.locator(".chat-message.assistant").last()).toContainText(
    "belum cukup",
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Dashboard" })
    .click();
  await expect(page.locator(".kpi-card")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("CSV upload, missing COGS and friendly invalid upload preserve existing data", async ({
  page,
}) => {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Data", exact: true })
    .click();
  await page
    .getByTestId("file-input")
    .setInputFiles({
      name: "penjualan.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "date,order_id,product_name,quantity,unit_price\n2026-09-30,A,Brownie,2,50000\n2026-09-30,B,Brownie,1,50000",
      ),
    });
  await expect(page.getByRole("status")).toContainText(
    "Data berhasil dianalisis.",
  );
  await expect(page.getByText("penjualan.csv", { exact: true })).toBeVisible();
  await page
    .getByTestId("file-input")
    .setInputFiles({
      name: "salah.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("nama,jumlah\nBrownie,3"),
    });
  await expect(page.locator(".upload-error")).toContainText(
    "Format data belum sesuai template RAMU.",
  );
  await expect(page.locator(".upload-error")).toContainText(
    "date, order_id, product_name, quantity, unit_price",
  );
  await expect(page.getByText("penjualan.csv", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Lihat Dashboard" }).click();
  await expect(
    page.getByText("Rp150.000", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Rp75.000", { exact: true })).toBeVisible();
  await expect(page.locator(".kpi-card").nth(1)).toContainText(
    "Data biaya belum tersedia",
  );
  await expect(page.locator(".product-table tbody tr").first()).toContainText(
    "-",
  );
});

test("Excel upload imports case-insensitive sheets and computes exact COGS profit", async ({
  page,
}) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([
      {
        date: "2026-09-30",
        order_id: "A",
        product_name: "Brownie",
        quantity: 2,
        unit_price: 50000,
      },
      {
        date: "2026-09-30",
        order_id: "B",
        product_name: "Brownie",
        quantity: 1,
        unit_price: 50000,
      },
    ]),
    "TRANSACTIONS",
  );
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([{ product_name: "Brownie", cogs: 20000 }]),
    "Products",
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Data", exact: true })
    .click();
  await page
    .getByTestId("file-input")
    .setInputFiles({
      name: "bakery.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
    });
  await expect(page.getByRole("status")).toContainText(
    "Data berhasil dianalisis.",
  );
  await page.getByRole("link", { name: "Lihat Dashboard" }).click();
  await expect(page.getByText("Rp90.000", { exact: true })).toBeVisible();
  await expect(page.locator(".product-table")).toContainText("60%");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Tanya RAMU" })
    .click();
  await page
    .getByRole("button", { name: "Produk mana yang paling menguntungkan?" })
    .click();
  await expect(page.locator(".chat-message.assistant")).toContainText(
    "Rp90.000",
  );
});

test("template downloads produce usable files and data resets on full reload", async ({
  page,
}) => {
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Data", exact: true })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Template Excel" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("template-ramu.xlsx");
  const path = await download.path();
  await page
    .getByTestId("file-input")
    .setInputFiles({
      name: download.suggestedFilename(),
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await readFile(path!),
    });
  await expect(page.getByRole("status")).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Tanya RAMU" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Belum ada data bisnis" }),
  ).toBeVisible();
});

test("responsive mobile routes stay within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard." })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Upload Excel / CSV" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Tanya RAMU" })
    .click();
  await expect(page.getByLabel("Pertanyaan untuk RAMU")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("demo KPI values stay inside their cards on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await expect(page.locator(".kpi-card")).toHaveCount(4);

  const cards = await page.locator(".kpi-card").evaluateAll((elements) =>
    elements.map((card) => {
      const value = card.querySelector(".kpi-value")!;
      const range = document.createRange();
      range.selectNodeContents(value);
      const text = range.getBoundingClientRect();
      const bounds = card.getBoundingClientRect();
      return {
        value: value.textContent,
        fits: text.left >= bounds.left && text.right <= bounds.right,
      };
    }),
  );
  for (const card of cards) {
    expect(card.fits, `KPI ${card.value} must fit inside its card`).toBe(true);
  }
});
