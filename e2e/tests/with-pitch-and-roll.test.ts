import { expect, test } from "@playwright/test";
import loadFixtureAndGetMapHandle from "./helpers/loadFixtureAndGetMapHandle";

test("Loads the page without errors", async ({ page }, testInfo) => {
  const { mapHandle } = await loadFixtureAndGetMapHandle({
    fixture: "withPitchAndRoll",
    page,
  });
  
  expect(await page.title()).toBe("MapTiler E2E Load Model Test");
});

test("changes the pitch and roll of the model", async ({ page }, testInfo) => {
  const { mapHandle } = await loadFixtureAndGetMapHandle({
    fixture: "withPitchAndRoll",
    page,
  });

  expect(await page.title()).toBe("MapTiler E2E Load Model Test");

  await page.exposeFunction("notifyScreenshotStateReady", async (data: Record<string, TTestTransferData>) => {
    await expect(page).toHaveScreenshot(`pitch-and-roll-${data.frame}.png`);
  });

  await expect(page).toHaveScreenshot('pitch-and-roll-before.png');

  await page.evaluate(async () => {
    const NUM_SCREENSHOTS = 20;
    const NUM_FRAMES_BETWEEN_SCREENSHOTS = 20;

    const { advanceAnimation } = window.__pageObjects as { advanceAnimation: () => void };

    for (let i = 0; i < NUM_SCREENSHOTS; i++) {
      for (let j = 0; j < NUM_FRAMES_BETWEEN_SCREENSHOTS; j++) {
        console.log("ADVANCING ANIMATION", i, j);
        advanceAnimation();
      }

      await window.notifyScreenshotStateReady({
        frame: i,
      });
    }
  });
  let frame = 0;

  await expect(page).toHaveScreenshot(`pitch-and-roll-after-${frame}.png`);
})