import { expect, test } from "@playwright/test";
import loadFixtureAndGetMapHandle from "./helpers/loadFixtureAndGetMapHandle";
import { Map } from "@maptiler/sdk";

test("Loads and renders a mesh from a url", async ({ page }, testInfo) => {
  const { mapHandle } = await loadFixtureAndGetMapHandle({
    fixture: "withModel",
    page,
  });
  
  expect(await page.title()).toBe("MapTiler E2E Load Model Test");

  await expect(page).toHaveScreenshot('model-bearing-0.png');

  await mapHandle.evaluate((map: Map) => {
    map.setBearing(27);
    map.triggerRepaint();
  });

  await expect(page).toHaveScreenshot('model-bearing-27.png');
});

test("modifies the mesh correctly", async ({ page }, testInfo) => {
  const { mapHandle } = await loadFixtureAndGetMapHandle({
    fixture: "withModel",
    page,
  });
  
  expect(await page.title()).toBe("MapTiler E2E Load Model Test");

  await expect(page).toHaveScreenshot('model-modify-mesh-before.png');

  await page.evaluate(() => {
    // @ts-expect-error
    const layer3d = window.__layer3D as Layer3D;
    layer3d.modifyMesh('duck', {
      altitude: 50,
      scale: 50,
      lngLat: [0.001, 0.001],
    });
  });

  await expect(page).toHaveScreenshot('model-modify-mesh-after.png');
})

