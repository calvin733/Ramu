import { expect, test } from "@playwright/test";
import { analyzeBusiness } from "../../lib/analytics";
import { createDemoData } from "../../lib/demo";
import { channelPerformance } from "../../lib/queries/aggregates";
import { formatRupiah, formatPercentage } from "../../lib/utils";
const metrics = analyzeBusiness(createDemoData())!;

test("executive overview fits the first desktop viewport and keeps header seamless", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await expect(page.locator(".kpi-card")).toHaveCount(4);
  await page.getByText("Angka lainnya", { exact: true }).click();
  await expect(page.locator(".summary-more")).toContainText(
    metrics.units.toLocaleString("id-ID"),
  );
  const chart = await page.locator(".revenue-panel").boundingBox();
  const pulse = await page.locator(".business-pulse").boundingBox();
  expect(pulse!.y + pulse!.height).toBeLessThanOrEqual(chart!.y);
  expect(pulse!.y + pulse!.height).toBeLessThan(900);
  expect(
    (await page.locator(".channel-panel").boundingBox())!.y,
  ).toBeGreaterThan(chart!.y);
  expect(
    await page
      .locator(".executive-grid")
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      ),
  ).toBe(12);
  const channel = channelPerformance(metrics)[0];
  await expect(page.locator(".channel-ranking li").first()).toContainText(
    channel.name,
  );
  await expect(page.locator(".channel-ranking li").first()).toContainText(
    formatPercentage(channel.contribution!),
  );
  await expect(page.locator(".channel-ranking li").first()).toContainText(
    formatRupiah(channel.revenue),
  );
  await expect(page.locator(".executive-product-table tbody tr")).toHaveCount(
    5,
  );
  await expect(
    page.locator(".executive-product-table tbody tr").first(),
  ).toContainText(metrics.products[0].name);
  await expect(page.locator(".executive-grid .liquid-layer")).toHaveCount(0);
  await expect(page.locator(".period-highlights")).toContainText(
    "Bulan terbaik",
  );
  await page.getByLabel("Tampilan waktu grafik").selectOption("day");
  await expect(page.locator(".period-highlights")).toContainText(
    "Hari terbaik",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  const top = await page.locator(".topbar").evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    shadow: getComputedStyle(el).boxShadow,
    radius: getComputedStyle(el).borderRadius,
  }));
  expect(top).toEqual({
    bg: "rgba(0, 0, 0, 0)",
    shadow: "none",
    radius: "0px",
  });
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.locator(".topbar")).toHaveClass(/scrolled/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".topbar")).not.toHaveClass(/scrolled/);
  for (const width of [1200, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".kpi-card")).toHaveCount(4);
    await expect(page.locator(".channel-panel")).toBeVisible();
    if (width <= 640) {
      const grid = await page.locator(".executive-grid").boundingBox();
      for (const panel of await page.locator(".executive-grid > *").all()) {
        const bounds = await panel.boundingBox();
        expect(Math.abs(bounds!.width - grid!.width)).toBeLessThan(2);
      }
    }
  }
  expect(errors).toEqual([]);
});

test("basic chat answers channels, follow-ups, product comparisons and specific limitations", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Tanya RAMU" })
    .click();
  await expect(
    page.getByRole("button", { name: "Channel mana yang paling besar?" }),
  ).toBeVisible();
  const send = async (q: string) => {
    await page.getByLabel("Pertanyaan untuk RAMU").fill(q);
    await page.getByRole("button", { name: "Kirim pertanyaan" }).click();
    await expect(page.getByLabel("Pertanyaan untuk RAMU")).toBeEnabled();
    return page.locator(".chat-message.assistant").last();
  };
  const top = channelPerformance(metrics).filter(
    (c) => c.name !== "Tanpa kanal",
  );
  await expect(await send("Channel penjualan terbaik apa?")).toContainText(
    top[0].name,
  );
  await expect(await send("Kalau yang kedua?")).toContainText(top[1].name);
  await expect(await send(`Berapa kontribusi ${top[0].name}?`)).toContainText(
    formatPercentage(top[0].contribution!),
  );
  const comparison = await send("Bandingkan Fudgy Brownie dan Ladyfinger");
  await expect(comparison).toContainText("Brownie");
  await expect(comparison).toContainText("Ladyfinger");
  await expect(comparison).toContainText("penjualan");
  await expect(comparison).not.toContainText("Margin");
  await expect(await send("Siapa pelanggan terbaik?")).toContainText(
    "data pelanggan",
  );
  await expect(await send("Prediksi bulan depan?")).toContainText("prediksi");
  await expect(page.locator(".message-mode").last()).toHaveText(
    "Analisis dasar",
  );
});
