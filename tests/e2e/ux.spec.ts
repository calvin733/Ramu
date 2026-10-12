import { expect, test, type Page } from "@playwright/test";
import { createDemoData } from "../../lib/demo";
import { calculateGoal, type BusinessGoal } from "../../lib/goals";
import { formatRupiah, formatPercentage } from "../../lib/utils";

const navigate = async (page: Page, label: string) =>
  page
    .getByRole("navigation")
    .getByRole("link", { name: label, exact: true })
    .click();
const createGoal = async (
  page: Page,
  target = "100000000",
  period = "monthly",
) => {
  await page
    .getByRole("button", { name: "Tambah Target", exact: true })
    .click();
  await page.getByLabel("Periode", { exact: true }).selectOption(period);
  await page.getByLabel("Nilai Target").fill(target);
  await page.getByRole("button", { name: "Simpan Target" }).click();
};

test("mobile chat keeps the welcome content visible and input readable", async ({
  page,
}) => {
  await page.goto("/data");
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await navigate(page, "Target Bisnis");
  await createGoal(page);
  await navigate(page, "Tanya RAMU");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const fits = await page
      .locator(".chat-messages-empty")
      .evaluate((container) => {
        const welcome = container.querySelector(".chat-welcome-icon")!;
        return (
          welcome.getBoundingClientRect().top >=
          container.getBoundingClientRect().top
        );
      });
    expect(
      fits,
      `Welcome content starts inside the scroll area at ${width}px`,
    ).toBe(true);
    const input = page.getByLabel("Pertanyaan untuk RAMU");
    await expect(input).toBeVisible();
    expect(await input.getAttribute("rows")).toBe("2");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("Data → executive overview → goal → compact preview → business conversation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Tambahkan Data", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hubungkan Data Bisnis" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Upload Excel / CSV" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await expect(page).toHaveURL(/\/data$/);
  await expect(page.getByRole("status")).toHaveText("Data berhasil diproses");
  await expect(page.locator(".active-filename")).toHaveText(
    createDemoData().source.name,
  );
  await expect(page.locator(".capability-statuses li")).toHaveCount(6);
  await expect(page.locator(".capability-statuses .available")).toHaveCount(6);
  await expect(page.locator(".upload-dropzone")).toHaveCount(0);
  await page.getByRole("link", { name: "Lihat Dashboard" }).click();
  await expect(page.locator(".kpi-card")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "Yang Perlu Anda Tahu" }),
  ).toBeVisible();
  expect(await page.locator(".insight-card").count()).toBeLessThanOrEqual(3);
  await expect(page.locator(".product-preview-list li")).toHaveCount(3);
  await expect(page.locator(".product-table")).toHaveCount(0);
  await page.getByRole("link", { name: "Buat Target", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Belum ada target bisnis." }),
  ).toBeVisible();
  await createGoal(page);
  const goal: BusinessGoal = {
    id: "test",
    metric: "revenue",
    period: "monthly",
    target: 100000000,
    createdAt: "2026-09-01T00:00:00.000Z",
    enabled: true,
  };
  const progress = calculateGoal(goal, createDemoData());
  await expect(page.locator(".goal-card")).toContainText(
    formatRupiah(progress.actual!),
  );
  await expect(page.locator(".goal-card")).toContainText(
    `Sisa ${formatRupiah(progress.remaining!)}`,
  );
  await expect(page.locator(".goal-card")).toContainText(
    `${progress.daysRemaining} hari tersisa`,
  );
  await expect(page.locator(".goal-card")).toContainText(
    `${formatPercentage(progress.progressPercentage!)} tercapai`,
  );
  await expect(
    page.locator(".kpi-card, .revenue-chart, .product-table"),
  ).toHaveCount(0);
  await navigate(page, "Dashboard");
  await expect(page.locator(".goal-preview-card")).toHaveCount(1);
  await expect(page.locator(".goal-preview-card")).toContainText(
    formatRupiah(progress.remaining!),
  );
  await expect(
    page.locator(".dashboard-goals button, .dashboard-goals details"),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit Target" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Lihat Semua Target" }),
  ).toBeVisible();
  await page
    .locator(".insights-section")
    .getByRole("link", { name: "Tanya RAMU" })
    .click();
  await expect(page.locator(".chat-data-context")).toContainText(
    createDemoData().source.name,
  );
  await expect(page.locator(".chat-data-context")).toContainText(
    "baris transaksi",
  );
  await expect(
    page.getByRole("button", {
      name: "Berapa lagi target pendapatan bulan ini?",
    }),
  ).toBeVisible();
  await expect(
    page.locator(".kpi-card, .revenue-chart, .product-table, .goal-card"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Bagaimana performa bisnis saya?" })
    .click();
  await expect(page.locator(".chat-message.assistant")).toContainText(
    "Pendapatan",
  );
  await expect(page.locator(".message-mode")).toHaveText("Analisis dasar");
  await page
    .locator(".chat-data-context")
    .getByRole("link", { name: "Kelola Data" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Data berhasil diproses");
  await expect(page.locator(".upload-dropzone")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("partial data, confirmed mapping, replacement, and deletion stay clear", async ({
  page,
}) => {
  await page.goto("/data");
  await page.getByTestId("file-input").setInputFiles({
    name: "Penjualan September.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Tanggal,No Invoice,Nama Barang,Qty,Harga\n2026-09-30,A,Brownie,2,50000",
    ),
  });
  await page
    .getByRole("button", { name: "Konfirmasi & Analisis Data" })
    .click();
  await expect(page.locator(".active-filename")).toHaveText(
    "Penjualan September.csv",
  );
  await expect(page.getByRole("status")).toHaveText("Data berhasil diproses");
  await expect(
    page.locator(".capability-statuses li").filter({ hasText: "HPP" }),
  ).toContainText("Belum tersedia");
  await expect(
    page.locator(".capability-statuses li").filter({ hasText: "Pengeluaran" }),
  ).toContainText("Belum tersedia");
  await expect(page.locator(".capability-explanations")).toContainText(
    "Data pengeluaran belum tersedia",
  );
  await page.getByRole("link", { name: "Lihat Dashboard" }).click();
  await navigate(page, "Data Bisnis");
  await expect(page.locator(".mapping-summary")).toHaveCount(0);
  await page.getByRole("button", { name: "Lihat Mapping" }).click();
  await expect(
    page
      .locator(".mapping-pairs div")
      .filter({ has: page.locator("dt", { hasText: /^No Invoice$/ }) }),
  ).toContainText("Nomor Pesanan");
  await expect(
    page
      .locator(".mapping-pairs div")
      .filter({ has: page.locator("dt", { hasText: /^Harga$/ }) }),
  ).toContainText("Harga Satuan");
  await page.getByRole("button", { name: "Ganti Data", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Upload Excel / CSV" }),
  ).toBeVisible();
  await page.getByTestId("file-input").setInputFiles({
    name: "rusak.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Nama,Jumlah\nBrownie,2"),
  });
  await page
    .getByRole("button", { name: "Konfirmasi & Analisis Data" })
    .click();
  await expect(page.locator(".upload-error[role=alert]")).toContainText(
    "Data yang sebelumnya digunakan tetap tersedia",
  );
  await expect(page.locator(".active-filename")).toHaveText(
    "Penjualan September.csv",
  );
  await page.getByTestId("file-input").setInputFiles({
    name: "Ringkasan.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Tanggal,Pendapatan\n2026-09-30,90000"),
  });
  await page
    .getByRole("button", { name: "Konfirmasi & Analisis Data" })
    .click();
  await expect(page.locator(".active-filename")).toHaveText("Ringkasan.csv");
  await expect(page.locator(".upload-dropzone")).toHaveCount(0);
  await expect(
    page.locator(".capability-statuses li").filter({ hasText: "Pesanan" }),
  ).toContainText("Belum tersedia");
  await page.getByRole("button", { name: "Lihat Mapping" }).click();
  await expect(page.locator(".mapping-summary")).not.toContainText(
    "No Invoice",
  );
  await page.getByRole("link", { name: "Lihat Dashboard" }).click();
  await expect(page.locator(".kpi-card").first()).toContainText("Rp90.000");
  await expect(page.locator(".kpi-card").nth(2)).toContainText(
    "Data belum tersedia",
  );
  await navigate(page, "Data Bisnis");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Hapus Data" }).click();
  await expect(page.locator(".active-data")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Hubungkan Data Bisnis" }),
  ).toBeVisible();
});

test("goals show required pace, retain enable state on edit, and limit dashboard preview", async ({
  page,
}) => {
  await page.goto("/data");
  await page.getByTestId("file-input").setInputFiles({
    name: "historis.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Tanggal,Pendapatan\n2020-01-15,100000"),
  });
  await page
    .getByRole("button", { name: "Konfirmasi & Analisis Data" })
    .click();
  await navigate(page, "Target Bisnis");
  await createGoal(page, "1000000");
  await expect(page.locator(".goal-reminder")).toContainText(
    "Rp56.250 per hari",
  );
  await expect(page.locator(".goal-card")).toContainText("Sisa Rp900.000");
  await expect(page.locator(".goal-card")).toContainText("16 hari tersisa");
  await page.getByRole("button", { name: "Nonaktifkan Target" }).click();
  await expect(page.locator(".goal-card")).toHaveCount(0);
  await expect(page.locator(".paused-goal-card")).toContainText("Nonaktif");
  await page.getByRole("button", { name: "Edit Target" }).click();
  await page.getByLabel("Nilai Target").fill("2000000");
  await page.getByRole("button", { name: "Simpan Target" }).click();
  await expect(page.locator(".paused-goal-card")).toContainText("Rp2.000.000");
  await page.getByRole("button", { name: "Aktifkan Target" }).click();
  await createGoal(page, "1000000", "daily");
  await createGoal(page, "1000000", "yearly");
  await page
    .getByRole("button", { name: "Tambah Target", exact: true })
    .click();
  await page.getByLabel("Jenis Target").selectOption("grossProfit");
  await page.getByLabel("Nilai Target").fill("1000000");
  await page.getByRole("button", { name: "Simpan Target" }).click();
  await expect(page.locator(".goal-card")).toHaveCount(4);
  await navigate(page, "Dashboard");
  await expect(page.locator(".goal-preview-card")).toHaveCount(3);
  await expect(
    page.locator(".dashboard-goals .goal-card, .dashboard-goals button"),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Lihat Semua Target" }).click();
  await expect(page.locator(".goal-card")).toHaveCount(4);
});

test("empty pages, contextual questions, and AI mode badge remain distinct", async ({
  page,
}) => {
  await page.goto("/ask");
  await expect(page.locator(".empty-state")).toContainText(
    "Tambahkan data agar RAMU dapat menjawab pertanyaan tentang bisnis Anda",
  );
  await expect(page.locator(".chat-panel")).toHaveCount(0);
  await navigate(page, "Target Bisnis");
  await expect(
    page.getByRole("heading", { name: "Belum ada target bisnis." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buat Target Pertama" }).click();
  await page.getByLabel("Nilai Target").fill("1000000");
  await page.getByRole("button", { name: "Simpan Target" }).click();
  await expect(page.locator(".goal-card")).toContainText(
    "Tambahkan data bisnis",
  );
  await page.getByRole("button", { name: "Nonaktifkan Target" }).click();
  await navigate(page, "Data Bisnis");
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await navigate(page, "Tanya RAMU");
  await expect(
    page.getByRole("button", { name: /target.*bulan|progress target/ }),
  ).toHaveCount(0);
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({
      json: {
        text: "Penjelasan AI dari metrik terverifikasi.",
        mode: "gemini",
      },
    }),
  );
  await page
    .getByRole("button", { name: "Bagaimana performa bisnis saya?" })
    .click();
  await expect(page.locator(".message-mode")).toHaveText("Dibantu AI");
  await expect(page.locator(".chat-fallback-notice")).toHaveCount(0);
  await navigate(page, "Data Bisnis");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Hapus Data" }).click();
  await navigate(page, "Target Bisnis");
  await expect(page.locator(".paused-goal-card")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Hapus Target" }).click();
  await expect(
    page.getByRole("heading", { name: "Belum ada target bisnis." }),
  ).toBeVisible();
});
