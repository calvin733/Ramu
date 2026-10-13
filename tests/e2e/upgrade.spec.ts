import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { analyzeBusiness } from "../../lib/analytics";
import { createDemoData } from "../../lib/demo";
import { calculateGoal, type BusinessGoal } from "../../lib/goals";
import { formatRupiah } from "../../lib/utils";
const upload = async (
  page: import("@playwright/test").Page,
  name: string,
  content: string,
) => {
  await page.goto("/data");
  await page.getByTestId("file-input").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
};
test("Indonesian aliases and arbitrary Excel sheets are reviewed and analyzed", async ({
  page,
}) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.json_to_sheet([
      {
        Tanggal: "2026-09-20",
        "No Invoice": "A",
        "Nama Barang": "Roti",
        Qty: 2,
        Harga: 100000,
        Diskon: 10000,
      },
    ]),
    "Transaksi April",
  );
  await page.goto("/data");
  await page.getByTestId("file-input").setInputFiles({
    name: "penjualan.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
  });
  await expect(
    page.getByLabel("Dibaca sebagai Tanggal (Transaksi April)"),
  ).toHaveValue("date");
  await expect(
    page.getByLabel("Dibaca sebagai No Invoice (Transaksi April)"),
  ).toHaveValue("order_id");
  await expect(
    page.getByLabel("Dibaca sebagai Nama Barang (Transaksi April)"),
  ).toHaveValue("product_name");
  await page
    .getByRole("button", { name: "Konfirmasi & Analisis Data" })
    .click();
  await page.getByRole("link", { name: "Lihat Dashboard" }).click();
  await expect(page.locator(".kpi-card").first()).toContainText("Rp190.000");
});
test("manual mapping works without AI and absent metrics stay unavailable", async ({
  page,
}) => {
  await upload(page, "ambigu.csv", "Kapan,Angka\n2026-09-20,123000");
  await page.getByRole("button", { name: "Biarkan RAMU Membantu" }).click();
  await expect(page.getByRole("status")).toContainText("memilih kolom sendiri");
  await page
    .getByLabel("Dibaca sebagai Kapan (Penjualan)")
    .selectOption("date");
  await page
    .getByLabel("Dibaca sebagai Angka (Penjualan)")
    .selectOption("revenue");
  await page
    .getByRole("button", { name: "Konfirmasi & Analisis Data" })
    .click();
  await page.getByRole("link", { name: "Lihat Dashboard" }).click();
  await expect(page.locator(".kpi-card").first()).toContainText("Rp123.000");
  await expect(page.locator(".kpi-card").nth(2)).toContainText(
    "Belum tersedia",
  );
  await expect(page.locator(".kpi-card").nth(3)).toContainText(
    "Belum tersedia",
  );
  await expect(page.locator(".product-table")).toHaveCount(0);
});
test("monthly goals persist, calculate progress, appear on dashboard and answer chat", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Target Bisnis" })
    .click();
  await page
    .getByRole("button", { name: "Tambah Target", exact: true })
    .click();
  await page.getByLabel("Jenis Target").selectOption("revenue");
  await page.getByLabel("Periode", { exact: true }).selectOption("monthly");
  await page.getByLabel("Nilai Target").fill("Rp100.000.000");
  await page.getByRole("button", { name: "Simpan Target" }).click();
  const goal: BusinessGoal = {
    id: "test",
    metric: "revenue",
    period: "monthly",
    target: 100000000,
    createdAt: "2026-09-01T00:00:00.000Z",
    enabled: true,
  };
  const p = calculateGoal(goal, createDemoData(), "2026-10-11");
  await expect(page.locator(".goal-card")).toContainText(
    formatRupiah(p.actual!),
  );
  await expect(page.locator(".goal-card")).toContainText(
    `Sisa ${formatRupiah(p.remaining!)}`,
  );
  await expect(page.locator(".goal-card")).toContainText(
    "Periode sudah selesai",
  );
  await page
    .getByRole("button", { name: "Jelaskan Target dengan RAMU" })
    .click();
  await expect(page.locator(".goal-explanation")).toContainText(
    formatRupiah(p.actual!),
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Dashboard" })
    .click();
  await expect(page.locator(".dashboard-goals")).toContainText(
    formatRupiah(p.remaining!),
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Tanya RAMU" })
    .click();
  await page
    .getByLabel("Pertanyaan untuk RAMU")
    .fill("Berapa lagi target pendapatan bulan ini?");
  await page.getByRole("button", { name: "Kirim pertanyaan" }).click();
  await expect(page.locator(".chat-message.assistant").last()).toContainText(
    formatRupiah(p.remaining!),
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Target Bisnis" })
    .click();
  await page.waitForURL("**/goals");
  await page.reload();
  await expect(page.locator(".goal-card")).toContainText(
    "Tambahkan data bisnis",
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Dashboard" })
    .click();
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await expect(
    page.locator(".dashboard-goals .goal-preview-card"),
  ).toContainText(formatRupiah(p.actual!));
  expect(errors).toEqual([]);
  expect(analyzeBusiness(createDemoData())!.revenue).toBe(p.actual);
});
test("goals validate input, warn about duplicates, support editing/deletion and survive corrupt storage", async ({
  page,
}) => {
  await page.goto("/goals");
  await page.evaluate(() =>
    localStorage.setItem("ramu.businessGoals.v1", "not-json"),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Belum ada target bisnis." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tambah Target" }).click();
  await page.getByLabel("Nilai Target").fill("0");
  await page.getByRole("button", { name: "Simpan Target" }).click();
  await expect(page.locator(".goal-form [role=alert]")).toContainText(
    "lebih dari nol",
  );
  await page.getByLabel("Nilai Target").fill("1000");
  await page.getByRole("button", { name: "Simpan Target" }).click();
  await page.getByRole("button", { name: "Tambah Target" }).click();
  await page.getByLabel("Nilai Target").fill("2000");
  await page.getByRole("button", { name: "Simpan Target" }).click();
  await expect(page.locator(".goal-form [role=alert]")).toContainText(
    "sudah ada",
  );
  await page.getByRole("button", { name: "Batal" }).click();
  await page.getByRole("button", { name: "Edit Target" }).click();
  await page.getByLabel("Periode", { exact: true }).selectOption("yearly");
  await page.getByRole("button", { name: "Simpan Target" }).click();
  await expect(page.locator(".goal-card h3")).toContainText("Tahunan");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Hapus Target" }).click();
  await expect(page.locator(".goal-card")).toHaveCount(0);
});
test("readable UI and upgrade routes fit mobile and laptop layouts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const label of [
      "Dashboard",
      "Data Bisnis",
      "Target Bisnis",
      "Tanya RAMU",
    ] as const) {
      await page
        .getByRole("navigation")
        .getByRole("link", { name: label, exact: true })
        .click();
      await page.waitForURL(
        `**/${{ Dashboard: "dashboard", "Data Bisnis": "data", "Target Bisnis": "goals", "Tanya RAMU": "ask" }[label]}`,
      );
      await expect(page.locator(".page-heading h1")).toContainText(
        label === "Data Bisnis" ? "Data Bisnis" : label,
      );
      await expect(page.locator(".page-heading h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${label} at ${width}px`,
      ).toBe(true);
      expect(
        await page
          .locator("body")
          .evaluate((e) => Number.parseFloat(getComputedStyle(e).fontSize)),
      ).toBeGreaterThanOrEqual(15);
      await expect(page.locator(".page-heading h1")).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator(".page-heading h1")
            .evaluate((e) => Number.parseFloat(getComputedStyle(e).fontSize)),
        )
        .toBeGreaterThanOrEqual(label === "Dashboard" ? 28 : 32);
    }
  }
  expect(errors).toEqual([]);
});
