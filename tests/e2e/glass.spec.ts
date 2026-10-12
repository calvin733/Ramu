import { expect, test, type Page } from "@playwright/test";

async function mockWebGL(
  page: Page,
  mode: "mock" | "unavailable" | "failure" | "shader-failure" | "software",
) {
  await page.addInitScript((mode) => {
    const stats = { active: 0, max: 0, draws: 0, resourcesDeleted: 0 };
    Object.defineProperty(window, "ramuGlassTest", { value: stats });
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (kind !== "webgl2")
        return Reflect.apply(original, this, [kind, ...args]);
      if (mode === "unavailable") return null;
      if (mode === "failure") throw new Error("GPU initialization unavailable");
      stats.active++;
      stats.max = Math.max(stats.max, stats.active);
      let lost = false;
      const gl = new Proxy(
        {},
        {
          get(_target, property) {
            if (property === "isContextLost") return () => lost;
            if (property === "getExtension")
              return (name: string) =>
                name === "WEBGL_debug_renderer_info" && mode === "software"
                  ? { UNMASKED_RENDERER_WEBGL: 123 }
                  : name === "WEBGL_lose_context"
                    ? {
                        loseContext() {
                          if (!lost) {
                            lost = true;
                            stats.active--;
                          }
                        },
                      }
                    : null;
            if (property === "getParameter") return () => "SwiftShader";
            if (property === "drawArrays")
              return () => {
                stats.draws++;
              };
            if (property === "getShaderParameter")
              return () => mode !== "shader-failure";
            if (property === "getProgramParameter") return () => true;
            if (property === "getAttribLocation") return () => 0;
            if (
              String(property).startsWith("create") ||
              property === "getUniformLocation"
            )
              return () => ({});
            if (String(property).startsWith("delete"))
              return () => {
                stats.resourcesDeleted++;
              };
            if (String(property).toUpperCase() === property) return 1;
            return () => {};
          },
        },
      );
      return gl;
    } as typeof original;
  }, mode);
}

const stats = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          ramuGlassTest: {
            active: number;
            max: number;
            draws: number;
            resourcesDeleted: number;
          };
        }
      ).ramuGlassTest,
  );
const nav = async (page: Page, label: string) =>
  page
    .getByRole("navigation")
    .getByRole("link", { name: label, exact: true })
    .click();

test("glass keeps navigation, text contrast, and touch targets readable", async ({
  page,
}) => {
  await mockWebGL(page, "unavailable");
  await page.goto("/data");
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(4);
  await expect(
    page.getByRole("link", { name: "Data Bisnis", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const contrast = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const rgb = (hex: string) =>
      [0, 2, 4].map((i) => parseInt(hex.trim().slice(1 + i, 3 + i), 16) / 255);
    const luminance = (values: number[]) =>
      values
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const foreground = luminance(rgb(style.getPropertyValue("--ramu-muted")));
    const darkestAtmosphere = luminance(
      rgb(style.getPropertyValue("--ramu-sage")),
    );
    return (darkestAtmosphere + 0.05) / (foreground + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const button = page.getByRole("button", { name: "Upload Excel / CSV" });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(button).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const dropzone = page.locator(".upload-dropzone");
  const initial = await dropzone.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await page.locator(".upload-panel").dispatchEvent("dragover");
  await expect(page.locator(".upload-panel")).toHaveClass(/drag-active/);
  await expect
    .poll(() =>
      dropzone.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(initial);
});

for (const mode of [
  "unavailable",
  "failure",
  "shader-failure",
  "software",
] as const) {
  test(`CSS fallback keeps controls functional when WebGL is ${mode}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await mockWebGL(page, mode);
    await page.goto("/data");
    await expect(
      page.getByRole("button", { name: "Upload Excel / CSV" }),
    ).toBeVisible();
    await expect(
      page.locator(".liquid-layer[data-glass-state=webgl]"),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Gunakan Data Demo" }).click();
    await expect(page.getByRole("status")).toHaveText("Data berhasil diproses");
    await nav(page, "Tanya RAMU");
    await page
      .getByRole("button", { name: "Bagaimana performa bisnis saya?" })
      .click();
    await expect(page.locator(".chat-message.assistant")).toContainText(
      "Pendapatan",
    );
    await expect(page.locator(".message-mode")).toHaveText("Analisis dasar");
    await expect(page.locator(".liquid-canvas")).toHaveCount(0);
    expect((await stats(page)).active).toBe(0);
    expect(errors).toEqual([]);
  });
}

test("WebGL is bounded, idle, and cleaned up as routes and motion preferences change", async ({
  page,
}) => {
  await mockWebGL(page, "mock");
  await page.goto("/goals");
  await expect.poll(async () => (await stats(page)).active).toBe(2);
  expect((await stats(page)).max).toBeLessThanOrEqual(2);
  await expect(page.locator(".liquid-canvas")).toHaveCount(2);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("main")!.style.minHeight = "1800px";
    window.scrollTo(0, 1200);
  });
  await expect.poll(async () => (await stats(page)).active).toBe(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(async () => (await stats(page)).active).toBe(2);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.mouse.move(1400, 10);
  const before = (await stats(page)).draws;
  await page.waitForTimeout(350);
  const settled = (await stats(page)).draws;
  await page.waitForTimeout(350);
  expect((await stats(page)).draws).toBe(settled);
  expect(settled - before).toBeLessThanOrEqual(2);
  await nav(page, "Dashboard");
  await expect.poll(async () => (await stats(page)).active).toBe(1);
  expect((await stats(page)).resourcesDeleted).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await stats(page)).active).toBe(0);
  await expect(page.locator(".liquid-canvas")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Dashboard", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await stats(page)).active).toBe(1);
  expect((await stats(page)).max).toBeLessThanOrEqual(2);
});

test("reduced motion and mobile use CSS glass without allocating GPU contexts", async ({
  page,
}) => {
  await mockWebGL(page, "mock");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/goals");
  await expect(
    page.getByRole("button", { name: "Tambah Target", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(250);
  expect((await stats(page)).active).toBe(0);
  expect(
    await page
      .locator(".button-primary")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  expect((await stats(page)).active).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("context loss falls back without losing keyboard navigation or goal controls", async ({
  page,
}) => {
  await mockWebGL(page, "mock");
  await page.goto("/goals");
  await expect(page.locator(".liquid-canvas")).toHaveCount(2);
  await page
    .locator(".liquid-canvas")
    .last()
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
  await expect(page.locator(".liquid-canvas")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Tambah Target", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Nilai Target").fill("1000000");
  await page.getByRole("button", { name: "Simpan Target" }).click();
  await expect(page.locator(".goal-card")).toContainText("Rp1.000.000");
  expect((await stats(page)).max).toBeLessThanOrEqual(2);
});
