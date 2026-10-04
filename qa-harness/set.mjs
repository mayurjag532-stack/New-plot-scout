import { launch } from "./harness.mjs";
const out=[];
for (const [tag, dark, w, h] of [["m-l", false, 390, 844], ["d-d", true, 1366, 860]]) {
  const { browser, page, shot, errors } = await launch({ dark, w, h });
  await page.getByRole("button", { name: /^Settings/ }).first().click();
  await page.waitForTimeout(900);
  await shot(`set-${tag}-1`);
  await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(400);
  await shot(`set-${tag}-2`);
  await page.evaluate(() => window.scrollTo(0, 1800)); await page.waitForTimeout(400);
  await shot(`set-${tag}-3`);
  out.push([tag, await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth), errors.filter(e=>!/same key/.test(e))]);
  await browser.close();
}
console.log(JSON.stringify(out));
