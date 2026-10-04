import { launch } from "./harness.mjs";
const out = [];
for (const [tag, dark, w, h] of [["m-l", false, 390, 844], ["d-d", true, 1366, 860]]) {
  const { browser, page, shot, errors } = await launch({ dark, w, h });
  await page.getByRole("button", { name: /Filter & sort/ }).first().click();
  await page.waitForSelector(".ps-fsheet");
  await page.waitForTimeout(900);
  await shot(`flt-${tag}-open`);
  const min = page.getByLabel("Minimum price");
  await min.evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, 40); el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.getByRole("button", { name: "Hold", exact: true }).click();
  await page.waitForTimeout(400);
  await shot(`flt-${tag}-set`);
  out.push([tag, await page.locator(".ps-ffoot button").innerText()]);
  await page.locator(".ps-ffoot button").click();
  await page.waitForTimeout(600);
  await shot(`flt-${tag}-applied`);
  out.push([tag, await page.locator(".ps-fchips").innerText().catch(() => "no chips"), errors.filter(e => !/same key/.test(e))]);
  await browser.close();
}
console.log(JSON.stringify(out));
