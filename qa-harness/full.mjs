// usage: node full.mjs <tag> <dark 0/1> <w> <h> [fixtureText]
import { launch } from "./harness.mjs";
const [tag, dark, w, h, fx] = [process.argv[2], process.argv[3]==="1", +process.argv[4]||390, +process.argv[5]||844, process.argv[6]||"QA Fixture · Mulshi"];
const { browser, page } = await launch({ dark, w, h });
await page.locator(`button:has-text('${fx}')`).first().click();
await page.waitForTimeout(900);
while (await page.locator(".ps-dsec-head[aria-expanded=false]").count()) { await page.locator(".ps-dsec-head[aria-expanded=false]").first().click(); await page.waitForTimeout(80); }
await page.waitForTimeout(900);
const total = await page.evaluate(() => document.documentElement.scrollHeight);
const step = h * 2 - 80;
let i = 0;
for (let y = 0; y < total && i < 12; y += step, i++) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `shots/full-${tag}-${i}.png` });
}
console.log(tag, "height", total, "shots", i);
await browser.close();
