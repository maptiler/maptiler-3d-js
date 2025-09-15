import { expect, test } from "@playwright/test";
import loadFixtureAndGetMapHandle from "./helpers/loadFixtureAndGetMapHandle";
import { Map } from "@maptiler/sdk";

test("Loads and renders Mesh", async ({ page }, testInfo) => {
  const { mapHandle } = await loadFixtureAndGetMapHandle({
    fixture: "withUIEvents",
    page,
  });
  
  expect(await page.title()).toBe("MapTiler E2E UI Events Test");

  const consoleLogs: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === 'log') { // Optional: Filter only for console.log
      consoleLogs.push(msg.text());
    }
  });

  const viewportDims = page.viewportSize();

  if (!viewportDims) {
    throw new Error("Viewport dimensions are not set");
  }

  await page.waitForTimeout(1000);

  const vpWidth = viewportDims.width;
  const vpHeight = viewportDims.height;

  await page.mouse.move(vpWidth / 2, vpHeight / 2 - 50);

  await expect(page).toHaveScreenshot('ui-events-mouseenter.png');

  await page.mouse.down();

  await expect(page).toHaveScreenshot('ui-events-mousedown.png');
  
  await page.mouse.up();

  await expect(page).toHaveScreenshot('ui-events-mouseup.png');
  
  await page.mouse.move(1, 1);

  await expect(page).toHaveScreenshot('ui-events-mouseleave.png');

  await page.mouse.dblclick(vpWidth / 2, vpHeight / 2 - 50);

  await expect(page).toHaveScreenshot('ui-events-doubleclick.png');

  await expect(consoleLogs).toContain("mouseenter");
  await expect(consoleLogs).toContain("mousedown");
  await expect(consoleLogs).toContain("mouseleave");
  await expect(consoleLogs).toContain("dblclick");
})

