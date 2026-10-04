import { launch } from "./harness.mjs";
const out = [];
for (const [tag, dark, w, h] of [["m-l", false, 390, 844], ["d-l", false, 1366, 860], ["m-d", true, 390, 844], ["d-d", true, 1366, 860]]) {
  const { browser, page, shot, errors } = await launch({ dark, w, h });
  await page.getByRole("button", { name: /^Compare/ }).first().click();
  await page.waitForTimeout(500); const cards = page.locator("button[aria-pressed]:has-text('QA Fixture')");
  const n = await cards.count();
  for (let i = 0; i < Math.min(3, n); i++) await cards.nth(i).click();
  await page.getByRole("button", { name: /Compare selected/ }).click();
  await page.waitForSelector(".ps-cmp");
  await page.waitForTimeout(1200);
  await shot(`cmp-${tag}-top`);
  await page.locator(".ps-cmp-scroll").evaluate((el) => (el.scrollTop = 600));
  await page.waitForTimeout(500);
  await shot(`cmp-${tag}-mid`);
  out.push([tag, "overflowX", await page.evaluate(() => document.querySelector(".ps-cmp-scroll").scrollWidth - document.querySelector(".ps-cmp-scroll").clientWidth), errors.filter(e => !/same key/.test(e))]);
  await browser.close();
}
console.log(JSON.stringify(out));
