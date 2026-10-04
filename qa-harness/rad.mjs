import { launch } from "./harness.mjs";
const out=[];
for (const [tag, dark, w, h] of [["m-l", false, 390, 844], ["d-d", true, 1366, 860]]) {
  const { browser, page, shot, errors } = await launch({ dark, w, h });
  await page.getByRole("button", { name: /^Radar/ }).first().click();
  await page.waitForTimeout(700);
  await shot(`rad-${tag}-empty`);
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 18.52, longitude: 73.85 });
  await page.getByRole("button", { name: /Use current location/ }).click();
  await page.waitForTimeout(2500);
  await shot(`rad-${tag}-scan`);
  out.push([tag, await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth), errors.filter(e=>!/same key|nominatim|Failed to load resource/.test(e))]);
  await browser.close();
}
console.log(JSON.stringify(out));
