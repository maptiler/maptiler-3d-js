import { expect, Page, PageAssertionsToHaveScreenshotOptions, TestInfo } from "@playwright/test";
import { writeFileSync } from "fs";
import path from "path";

export default async function expectScreenshotToMatch({
  page,
  name,
  options,
}: {
  page: Page;
  name: string;
  options?: PageAssertionsToHaveScreenshotOptions;
}) {
  const screenshotPath = path.resolve(import.meta.dirname, `./screenshots/${name}.png`);
  console.log(`Taking screenshot to ${screenshotPath}`);
  const screenshot = await page.screenshot();

  writeFileSync(screenshotPath, screenshot);

  await expect(page).toHaveScreenshot([screenshotPath]);
}