import { launch } from "./harness.mjs";
const out=[];
for (const [tag,dark,w,h] of [["m-l",false,390,844],["m-d",true,390,844],["d-d",true,1366,860]]) {
  const { browser, page, shot, errors } = await launch({ dark, w, h });
  await page.waitForTimeout(900);
  const m = page.locator(".ps-marker, .ps-marker-dot, .ps-div-icon").first();
  out.push([tag,"markers",await page.locator(".ps-div-icon").count()]);
  await page.locator(".ps-div-icon").first().click({ force:true });
  await page.waitForTimeout(1400);
  await shot(`sel-${tag}`);
  out.push([tag,"sheet", await page.locator("[role=dialog], .ps-sheet").count()]);
  // open from sheet / card
  const open = page.getByRole("button", { name: /Open dossier|View|Open/ }).first();
  if (await open.count()) { await open.click({force:true}); await page.waitForTimeout(1200); await shot(`sel-${tag}-dossier`); out.push([tag,"dossier", await page.locator(".ps-dpage").count()]); }
  out.push([tag, errors.filter(e=>!/same key/.test(e))]);
  await browser.close();
}
console.log(JSON.stringify(out));
