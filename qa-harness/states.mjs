import { launch } from "./harness.mjs";
const out=[];
// empty (no seed)
for (const [tag,dark,w,h] of [["m-l",false,390,844],["d-d",true,1366,860]]) {
  const { browser, page, shot, errors } = await launch({ dark, w, h, seed:false });
  await page.waitForTimeout(700); await shot(`state-empty-${tag}`);
  out.push([tag,"empty",errors.filter(e=>!/same key/.test(e))]);
  await browser.close();
}
// offline + tile failure (map blocked)
for (const [tag,dark,w,h] of [["m-l",false,390,844],["d-d",true,1366,860]]) {
  const { browser, page, shot, errors } = await launch({ dark, w, h, tilesMode:"block" });
  await page.waitForTimeout(1800);
  await page.context().setOffline(true);
  await page.evaluate(()=>window.dispatchEvent(new Event("offline")));
  await page.waitForTimeout(900); await shot(`state-offline-${tag}`);
  out.push([tag,"offline",await page.locator(".ps-offline").count(), await page.locator(".ps-tile-notice").count()]);
  await browser.close();
}
console.log(JSON.stringify(out));
