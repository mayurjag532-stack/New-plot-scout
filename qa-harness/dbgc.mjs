import { launch } from "./harness.mjs";
const { browser, page, shot } = await launch({ dark:false, w:390, h:844 });
await page.getByRole("button", { name: /^Compare/ }).first().click();
await page.waitForTimeout(600);
console.log(await page.locator("button[aria-pressed]").count(), await page.locator("button:has-text('QA Fixture')").count());
await shot("dbg-cmpmode");
await browser.close();
