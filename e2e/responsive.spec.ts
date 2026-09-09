import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

async function assertInsideViewport(page: Page, locator: Locator) {
  const bounds = await box(locator);
  const viewport = page.viewportSize()!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function assertNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(overflow.width).toBeLessThanOrEqual(overflow.client);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("printscope.help.seen", "1"));
  await page.goto("./");
});

test("empty state is centred, unobstructed, and themed", async ({ page }, testInfo) => {
  const empty = page.getByTestId("empty-upload-state");
  await expect(empty).toBeVisible();
  await expect(page.getByTestId("viewer-toolbar")).toHaveCount(0);
  await assertInsideViewport(page, empty);
  await assertNoPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("empty-dark.png"), fullPage: true });
  const themeButton = page.getByRole("button", { name: "Switch to light theme" });
  if (await themeButton.isVisible()) await themeButton.click();
  else { await page.getByRole("button", { name: "More actions" }).click(); await page.getByRole("menuitem", { name: /Theme/ }).click(); }
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.screenshot({ path: testInfo.outputPath("empty-light.png"), fullPage: true });
});

test("loaded toolbar stays within viewer at normal and zoomed layouts", async ({ page }, testInfo) => {
  await page.locator('input[type="file"][accept=".stl,.3mf"]').setInputFiles(path.resolve("src/test/fixtures/offset-tetrahedron.stl"));
  const toolbar = page.getByTestId("viewer-toolbar");
  await expect(toolbar).toBeVisible();
  const original = page.viewportSize()!;
  for (const zoom of [1, 1.25, 1.5, 2]) {
    await page.setViewportSize({ width: Math.max(320, Math.floor(original.width / zoom)), height: Math.max(568, Math.floor(original.height / zoom)) });
    await page.waitForTimeout(100);
    const viewer = await box(page.locator(".viewport"));
    const controls = await box(toolbar);
    expect(controls.x).toBeGreaterThanOrEqual(viewer.x);
    expect(controls.x + controls.width).toBeLessThanOrEqual(viewer.x + viewer.width + 1);
    expect(controls.y + controls.height).toBeLessThanOrEqual(viewer.y + viewer.height + 1);
    await assertNoPageOverflow(page);
  }
  await page.setViewportSize(original);
  await page.screenshot({ path: testInfo.outputPath("loaded-dark.png"), fullPage: true });
});

test("desktop panels do not intersect the viewer", async ({ page }) => {
  if (page.viewportSize()!.width < 1180) return;
  const left = await box(page.locator("aside.left"));
  const viewer = await box(page.locator(".viewport"));
  const right = await box(page.locator("aside.right"));
  expect(left.x + left.width).toBeLessThanOrEqual(viewer.x + 1);
  expect(viewer.x + viewer.width).toBeLessThanOrEqual(right.x + 1);
});
