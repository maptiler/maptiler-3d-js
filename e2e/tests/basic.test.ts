import { expect, test } from "@playwright/test";

import loadFixtureAndGetMapHandle from "./helpers/loadFixtureAndGetMapHandle";
import { Map } from "@maptiler/sdk";

test("Loads and renders a simple mesh", async ({ page }, testInfo) => {

  const { mapHandle } = await loadFixtureAndGetMapHandle({
    fixture: "basic",
    page,
  });
  
  expect(await page.title()).toBe("MapTiler 3D Basic Usage");

  await page.waitForTimeout(1000);
  await expect(page).toHaveScreenshot('basic-bearing-0.png');

  await mapHandle.evaluate((map: Map) => {
    map.setBearing(27);
    map.triggerRepaint();
  });

  await expect(page).toHaveScreenshot('basic-bearing-27.png');

});

