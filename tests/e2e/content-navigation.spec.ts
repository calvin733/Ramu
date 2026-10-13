import { expect, test, type Locator, type Page } from "@playwright/test";
import { GOALS_KEY, serializeGoals, type BusinessGoal } from "../../lib/goals";

type ScrollRequest = {
  text: string | null;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
};
type NavigationWindow = Window & { ramuScrollRequests: ScrollRequest[] };
async function observeNavigation(page: Page) {
  await page.addInitScript(() => {
    const original = Element.prototype.scrollIntoView;
    (window as unknown as NavigationWindow).ramuScrollRequests = [];
    Element.prototype.scrollIntoView = function (options) {
      (window as unknown as NavigationWindow).ramuScrollRequests.push({
        text: this.textContent?.trim() ?? null,
        ...(typeof options === "object"
          ? { behavior: options.behavior, block: options.block }
          : {}),
      });
      original.call(this, options);
    };
  });
}
async function expectDestination(
  page: Page,
  heading: Locator,
  behavior: ScrollBehavior,
) {
  await expect(heading).toBeFocused();
  await expect
    .poll(() =>
      heading.evaluate((element) => {
        const top = element.getBoundingClientRect().top;
        const navigation = document.querySelector(
          innerWidth <= 640 ? ".sidebar" : ".topbar",
        )!;
        return (
          top >= navigation.getBoundingClientRect().bottom &&
          top < innerHeight - 30
        );
      }),
    )
    .toBe(true);
  const text = await heading.textContent();
  await expect
    .poll(() =>
      page.evaluate(
        (text) =>
          (window as unknown as NavigationWindow).ramuScrollRequests
            .filter((r) => r.text === text)
            .at(-1)?.behavior,
        text,
      ),
    )
    .toBe(behavior);
}
const goals: BusinessGoal[] = [
  {
    id: "reveal-revenue",
    metric: "revenue",
    period: "monthly",
    target: 100000000,
    createdAt: "2026-10-13T00:00:00Z",
    enabled: true,
  },
  {
    id: "reveal-orders",
    metric: "orders",
    period: "monthly",
    target: 1500,
    createdAt: "2026-10-13T00:00:00Z",
    enabled: true,
  },
  {
    id: "reveal-units",
    metric: "units",
    period: "yearly",
    target: 10000,
    createdAt: "2026-10-13T00:00:00Z",
    enabled: true,
  },
  {
    id: "reveal-paused",
    metric: "grossProfit",
    period: "monthly",
    target: 90000000,
    createdAt: "2026-10-13T00:00:00Z",
    enabled: false,
  },
];
for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(`content navigation with motion ${reducedMotion}`, () => {
    test.use({ reducedMotion, viewport: { width: 390, height: 844 } });
    const behavior = reducedMotion === "reduce" ? "auto" : "smooth";
    test("Data reveals one management section, navigates/focuses only on open, and preserves the active source", async ({
      page,
    }) => {
      await observeNavigation(page);
      await page.goto("/data");
      await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
      await expect(
        page.getByRole("heading", { name: "Data Bisnis Aktif", exact: true }),
      ).toBeFocused();
      const replace = page.getByRole("button", {
        name: "Ganti Data",
        exact: true,
      });
      const mapping = page.getByRole("button", {
        name: "Lihat Mapping",
        exact: true,
      });
      await replace.click();
      await expect(replace).toHaveAttribute("aria-expanded", "true");
      await expect(replace).toHaveAttribute("aria-controls", "replace-data");
      await expect(page.locator("#active-mapping")).toBeHidden();
      const replacementHeading = page.getByRole("heading", {
        name: "Ganti Data Bisnis",
        exact: true,
      });
      await expectDestination(page, replacementHeading, behavior);
      await expect(
        page.getByRole("button", { name: "Upload Excel / CSV" }),
      ).toBeVisible();
      await expect(page.locator(".active-filename")).toHaveText(
        "Demo · Ramu Bakery",
      );
      await mapping.click();
      await expect(mapping).toHaveAttribute("aria-expanded", "true");
      await expect(mapping).toHaveAttribute("aria-controls", "active-mapping");
      await expect(page.locator("#replace-data")).toBeHidden();
      await expect(replace).toHaveAttribute("aria-expanded", "false");
      await expectDestination(
        page,
        page.getByRole("heading", {
          name: "Cara RAMU membaca data",
          exact: true,
        }),
        behavior,
      );
      await expect(page.locator("#active-mapping")).toContainText(
        "tidak perlu memilih kolom",
      );
      const requests = await page.evaluate(
        () => (window as unknown as NavigationWindow).ramuScrollRequests.length,
      );
      await mapping.click();
      await expect(mapping).toHaveAttribute("aria-expanded", "false");
      await expect(mapping).toBeFocused();
      await expect(page.locator("#active-mapping")).toBeHidden();
      expect(
        await page.evaluate(
          () => (window as unknown as NavigationWindow).ramuScrollRequests.length,
        ),
      ).toBe(requests);
      await mapping.click();
      await expectDestination(
        page,
        page.getByRole("heading", {
          name: "Cara RAMU membaca data",
          exact: true,
        }),
        behavior,
      );
      await replace.click();
      await expectDestination(page, replacementHeading, behavior);
      await expect(page.locator("#active-mapping")).toBeHidden();
      await expect(mapping).toHaveAttribute("aria-expanded", "false");
      await page
        .getByRole("button", { name: "Batal Ganti Data", exact: true })
        .click();
      await expect(page.locator("#replace-data")).toBeHidden();
      await expect(replace).toBeFocused();
      await expect(replace).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator(".active-filename")).toHaveText(
        "Demo · Ramu Bakery",
      );
      await replace.click();
      await expectDestination(page, replacementHeading, behavior);
      const beforeClose = await page.evaluate(
        () => (window as unknown as NavigationWindow).ramuScrollRequests.length,
      );
      await replace.click();
      await expect(page.locator("#replace-data")).toBeHidden();
      expect(
        await page.evaluate(
          () => (window as unknown as NavigationWindow).ramuScrollRequests.length,
        ),
      ).toBe(beforeClose);
    });
    test("Goals shares navigation for active/inactive edits and returns focus after cancel/save", async ({
      page,
    }) => {
      await observeNavigation(page);
      await page.addInitScript(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: GOALS_KEY, value: serializeGoals(goals) },
      );
      await page.goto("/data");
      await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "Target Bisnis", exact: true })
        .click();
      const units = page
        .locator(".goal-card")
        .filter({
          has: page.getByRole("heading", {
            name: "Unit Terjual Tahunan",
            exact: true,
          }),
        });
      const edit = units.getByRole("button", {
        name: "Edit Target",
        exact: true,
      });
      const formHeading = page.getByRole("heading", {
        name: "Edit Target Bisnis",
        exact: true,
      });
      await edit.click();
      await expectDestination(page, formHeading, behavior);
      await expect(edit).toHaveAttribute("aria-expanded", "true");
      await expect(edit).toHaveAttribute("aria-controls", "goal-form");
      await expect(page.getByLabel("Nilai Target")).toHaveValue("10000");
      await expect(page.getByLabel("Ukur berdasarkan")).toHaveValue("units");
      await expect(page.getByLabel("Periode", { exact: true })).toHaveValue(
        "yearly",
      );
      await page.getByLabel("Nilai Target").fill("99999");
      await page.getByRole("button", { name: "Batal", exact: true }).click();
      await expect(page.locator(".goal-form")).toHaveCount(0);
      await expect(edit).toBeFocused();
      expect(
        await page.evaluate(
          (key) =>
            JSON.parse(localStorage.getItem(key)!).goals.find(
              (g: BusinessGoal) => g.id === "reveal-units",
            ).target,
          GOALS_KEY,
        ),
      ).toBe(10000);
      await edit.click();
      await expectDestination(page, formHeading, behavior);
      await page.getByLabel("Nilai Target").fill("11000");
      await page
        .getByRole("button", { name: "Simpan Target", exact: true })
        .click();
      await expect(page.locator(".goal-form")).toHaveCount(0);
      await expectDestination(
        page,
        units.getByRole("heading", {
          name: "Unit Terjual Tahunan",
          exact: true,
        }),
        behavior,
      );
      await expect(units).toContainText("11.000");
      const paused = page.locator(".paused-goal-card");
      const pausedEdit = paused.getByRole("button", {
        name: "Edit Target",
        exact: true,
      });
      await pausedEdit.click();
      await expectDestination(page, formHeading, behavior);
      await expect(page.getByLabel("Nilai Target")).toHaveValue("90000000");
      await expect(page.getByLabel("Jenis Target")).toHaveValue("grossProfit");
      await page.getByLabel("Nilai Target").fill("95000000");
      await page
        .getByRole("button", { name: "Simpan Target", exact: true })
        .click();
      await expectDestination(
        page,
        paused.getByRole("heading", {
          name: "Laba Kotor Bulanan",
          exact: true,
        }),
        behavior,
      );
      await expect(paused).toContainText("Nonaktif");
      await expect(paused).toContainText("Rp95.000.000");
      await edit.click();
      await expectDestination(page, formHeading, behavior);
      const revenue = page
        .locator(".goal-card")
        .filter({
          has: page.getByRole("heading", {
            name: "Pendapatan Bulanan",
            exact: true,
          }),
        });
      await revenue
        .getByRole("button", { name: "Edit Target", exact: true })
        .click();
      await expectDestination(page, formHeading, behavior);
      await expect(page.getByLabel("Jenis Target")).toHaveValue("revenue");
      await expect(page.getByLabel("Nilai Target")).toHaveValue("100000000");
      const add = page.getByRole("button", {
        name: "Tambah Target",
        exact: true,
      });
      await add.click();
      await expectDestination(
        page,
        page.getByRole("heading", {
          name: "Tambah Target Bisnis",
          exact: true,
        }),
        behavior,
      );
      await expect(page.getByLabel("Nilai Target")).toHaveValue("");
      await expect(add).toHaveAttribute("aria-expanded", "true");
      await page.getByRole("button", { name: "Batal", exact: true }).click();
      await expect(add).toBeFocused();
      await expect(add).toHaveAttribute("aria-expanded", "false");
    });
  });
}
test("the first goal uses the same form handoff and focuses the new card after saving", async ({
  page,
}) => {
  await observeNavigation(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/goals");
  const first = page.getByRole("button", {
    name: "Buat Target Pertama",
    exact: true,
  });
  await first.click();
  await expectDestination(
    page,
    page.getByRole("heading", { name: "Tambah Target Bisnis", exact: true }),
    "auto",
  );
  await expect(page.getByLabel("Nilai Target")).toHaveValue("");
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(first).toBeFocused();
  await first.click();
  await page.getByLabel("Nilai Target").fill("1000000");
  await page
    .getByRole("button", { name: "Simpan Target", exact: true })
    .click();
  await expectDestination(
    page,
    page
      .locator(".goal-card")
      .getByRole("heading", { name: "Pendapatan Bulanan", exact: true }),
    "auto",
  );
  await expect(page.locator(".goal-card")).toContainText(
    "Tambahkan data bisnis",
  );
});
