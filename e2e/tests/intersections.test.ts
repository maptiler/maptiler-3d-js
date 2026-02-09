import { expect, test } from "@playwright/test";
import loadFixtureAndGetMapHandle from "./helpers/loadFixtureAndGetMapHandle";

test("loads the intersections fixture without errors", async ({ page }) => {
  const { mapHandle } = await loadFixtureAndGetMapHandle({
    fixture: "intersections",
    page,
  });

  expect(await page.title()).toBe("MapTiler E2E Item3D Intersections Test");
});

test("reports no intersection when items are apart", async ({ page }) => {
  await loadFixtureAndGetMapHandle({
    fixture: "intersections",
    page,
  });

  const hasIntersection = await page.evaluate(() => {
    const { itemOne, itemTwo } = window.__pageObjects as {
      itemOne: { intersects: (other: unknown, precision: string) => boolean };
      itemTwo: unknown;
    };
    return itemOne.intersects(itemTwo, "medium");
  });

  expect(hasIntersection).toBe(false);
  await expect(page).toHaveScreenshot("intersections-items-apart.png");
});

test("reports intersection when items overlap and changes mesh colour", async ({ page }) => {
  await loadFixtureAndGetMapHandle({
    fixture: "intersections",
    page,
    debug: true,
  });

  await page.exposeFunction(
    "notifyScreenshotStateReady",
    async (_data: Record<string, unknown>) => {
      await expect(page).toHaveScreenshot(`intersections-overlap-coloured-${_data.frame}.png`);
    }
  );

  const calls = await page.evaluate(async () => {
    const map = window.__map;
    const { itemOne, itemTwo, recursivelySetMaterialColor } = window.__pageObjects

    const calls = {
      frame0: false,
      frame1: false,
      frame2: false,
    };

    let frame = 0;

    async function wait(delayMS: number = 1000) {
      // Allow a frame for the scene to update
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(true)
        }, delayMS);
      }); 
    }

    if (itemOne.intersects(itemTwo, "low")) { 
        calls.frame0 = true;
        recursivelySetMaterialColor(itemOne.mesh, "blue");
        recursivelySetMaterialColor(itemTwo.mesh, "blue");
    }

    map.triggerRepaint();

    await wait(1000);

    await (window as Window & { notifyScreenshotStateReady?: (d: unknown) => Promise<void> })
      .notifyScreenshotStateReady?.({ frame: frame++ });

    // Move itemTwo to the same position as itemOne so they overlap
    itemTwo.modify({
      lngLat: [itemTwo.lngLat.lng + 0.0001, itemTwo.lngLat.lat],
    });

    map.triggerRepaint();

    await wait(1000);
  
    if (itemOne.intersects(itemTwo, "low")) {
      calls.frame1 = true;
      recursivelySetMaterialColor(itemOne.mesh, "blue");
      recursivelySetMaterialColor(itemTwo.mesh, "blue");
    }

    map.triggerRepaint();

    await wait(1000);

    await (window as Window & { notifyScreenshotStateReady?: (d: unknown) => Promise<void> })
      .notifyScreenshotStateReady?.({ frame: frame++ });

    // Move itemTwo to so both items overlap
    itemTwo.modify({
      lngLat: [itemOne.lngLat.lng + 0.0001, itemOne.lngLat.lat],
    });

    map.triggerRepaint();

    await wait(1000);

    if (itemOne.intersects(itemTwo, "low")) {
      calls.frame2 = true;
      recursivelySetMaterialColor(itemOne.mesh, "blue");
      recursivelySetMaterialColor(itemTwo.mesh, "blue");
    }

    map.triggerRepaint();

    await wait(1000);

    await (window as Window & { notifyScreenshotStateReady?: (d: unknown) => Promise<void> })
      .notifyScreenshotStateReady?.({ frame: frame++ });

    return calls;
  });

  expect(calls).toEqual({ frame0: false, frame1: false, frame2: true });
});
