import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import loadFixtureAndGetMapHandle from "./helpers/loadFixtureAndGetMapHandle";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const bundlePath = path.resolve(repoRoot, "build/maptiler-3d.min.mjs");
const sdkVersion: string = JSON.parse(readFileSync(path.resolve(repoRoot, "node_modules/@maptiler/sdk/package.json"), "utf-8")).version;

test("ES module CDN build loads with the SDK ES module CDN build", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  // The SDK CDN build matching the installed SDK version is used for the import map
  await page.addInitScript((version) => {
    // @ts-expect-error not declared on window, only used by the fixture
    window.__sdkCdnVersion = version;
  }, sdkVersion);

  // Serve the built bundle as is, as the CDN does (built by `npm run build-esm-cdn`)
  await page.route("http://localhost:5173/cdn/maptiler-3d/maptiler-3d.min.mjs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      path: bundlePath,
    }),
  );

  const { mapHandle } = await loadFixtureAndGetMapHandle({
    fixture: "esmCdnBuild",
    page,
  });

  expect(await page.title()).toBe("MapTiler E2E ESM CDN Build");
  expect(await mapHandle.evaluate((map) => map !== null)).toBe(true);

  await page.waitForFunction(() => !!window.__layer3D?.getItem3D("duck"), undefined, { timeout: 10000 });

  const result = await page.evaluate(() => {
    const item = window.__layer3D.getItem3D("duck");
    return {
      hasLayer: window.__map.getLayer("layer3d") !== undefined,
      // the plugin must use the page's SDK instance, not a copy of its own
      itemUsesPageSdk: item instanceof window.__pageObjects.Evented,
    };
  });

  expect(result).toEqual({ hasLayer: true, itemUsesPageSdk: true });
  expect(pageErrors).toEqual([]);
});
