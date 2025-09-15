import { expect, test } from "@playwright/test";
import loadFixtureAndGetMapHandle from "./helpers/loadFixtureAndGetMapHandle";
import { Map } from "@maptiler/sdk";

test("Loads and renders Mesh", async ({ page }, testInfo) => {
  const { mapHandle } = await loadFixtureAndGetMapHandle({
    fixture: "withUIStates",
    page,
  });
  
  expect(await page.title()).toBe("MapTiler E2E UI States Test");

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

  await expect(page).toHaveScreenshot('ui-states-hover.png');

  await page.mouse.down();

  await expect(page).toHaveScreenshot('ui-states-active.png');
  
  await page.mouse.up();

  await expect(page).toHaveScreenshot('ui-states-inactive.png');
  
  await page.mouse.move(1, 1);

  await expect(page).toHaveScreenshot('ui-states-hover-inactive.png');

  await page.mouse.dblclick(vpWidth / 2, vpHeight / 2 - 50);
})

