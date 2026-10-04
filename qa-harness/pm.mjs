import { launch } from "./harness.mjs";
const out=[];
for (const [tag,dark,w,h] of [["m-d",true,390,844],["d-l",false,1366,860]]) {
  const { browser, page, shot, errors } = await launch({ dark, w, h });
  await page.waitForTimeout(900);
  const sw = page.getByRole("button", { name: /Map style/ }).first();
  await sw.click(); await page.getByRole("button", { name: "Satellite", exact:true }).click(); await page.waitForTimeout(800);
  out.push([tag,"sat",await page.evaluate(()=>document.querySelector(".leaflet-container").dataset.basemap+" "+[...document.querySelectorAll("img.leaflet-tile")].filter(i=>/arcgis/.test(i.src)).length)]);
  await shot(`pm-sat-${tag}`);
  await sw.click(); await page.getByRole("button", { name: "Hybrid", exact:true }).click(); await page.waitForTimeout(800);
  out.push([tag,"hyb",await page.evaluate(()=>document.querySelector(".leaflet-container").dataset.basemap+" "+[...document.querySelectorAll("img.leaflet-tile")].filter(i=>/World_Boundaries/.test(i.src)).length)]);
  await shot(`pm-hyb-${tag}`);
  out.push([tag, errors.filter(e=>!/same key/.test(e))]);
  await browser.close();
}
console.log(JSON.stringify(out));
