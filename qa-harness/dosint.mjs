import { launch } from "./harness.mjs";
const out = [];
{ // mobile interactions
  const { browser, page, shot, errors } = await launch({ dark: false });
  await page.locator("button:has-text('QA Fixture · Mulshi')").first().click();
  await page.waitForTimeout(800);
  await page.locator(".ps-aerial").getByRole("button", { name: /Map style/ }).click();
  await shot("int-layers-open");
  await page.getByRole("button", { name: "Satellite", exact: true }).click();
  await page.waitForTimeout(500);
  out.push(["satellite basemap attr", await page.evaluate(() => document.querySelector(".ps-aerial .leaflet-container").dataset.basemap + " tiles:" + [...document.querySelectorAll(".ps-aerial img.leaflet-tile")].filter(i=>/arcgis/.test(i.src)).length)]);
  await shot("int-satellite");
  await page.locator(".ps-aerial").getByRole("button", { name: /Map style/ }).click();
  await page.getByRole("button", { name: "Hybrid", exact: true }).click();
  await page.waitForTimeout(500);
  out.push(["hybrid", await page.evaluate(() => document.querySelector(".ps-aerial .leaflet-container").dataset.basemap + " ref tiles:" + [...document.querySelectorAll(".ps-aerial img.leaflet-tile")].filter(i=>/World_Boundaries/.test(i.src)).length)]);
  await shot("int-hybrid");
  await page.getByRole("button", { name: "Explore map" }).click();
  await page.waitForTimeout(800);
  await shot("int-explore");
  await page.getByRole("button", { name: "Done exploring map" }).click();
  await page.getByRole("tab", { name: /Photos/ }).click();
  await page.waitForTimeout(500);
  await shot("int-photos");
  await page.getByRole("tab", { name: "Aerial" }).click();
  // nav jump to Decision
  await page.locator(".ps-dnav").getByRole("button", { name: /^Decision/ }).click();
  await page.waitForTimeout(1200);
  await shot("int-jump-decision");
  out.push(["errors", errors.filter(e=>!/same key/.test(e))]);
  await browser.close();
}
console.log(JSON.stringify(out, null, 1));
