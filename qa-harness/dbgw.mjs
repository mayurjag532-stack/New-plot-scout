import { launch } from "./harness.mjs";
const { browser, page } = await launch({ dark:false, w:390, h:844 });
await page.waitForTimeout(900);
const r = await page.evaluate(()=>{
  const out=[];
  for (const e of document.querySelectorAll("body *")) { if (e.closest(".leaflet-container")) continue; const b=e.getBoundingClientRect(); if (b.right>392||b.left<-2) out.push(e.tagName+"."+String(e.className).slice(0,50)+" l="+Math.round(b.left)+" r="+Math.round(b.right)); }
  return {iw:innerWidth, dw:document.documentElement.clientWidth, out:out.slice(0,10)};
});
console.log(JSON.stringify(r,null,1));
await page.locator(".ps-div-icon").first().click({ force:true });
await page.waitForTimeout(1400);
const r2 = await page.evaluate(()=>{
  const out=[];
  for (const e of document.querySelectorAll("body *")) { if (e.closest(".leaflet-container")) continue; const b=e.getBoundingClientRect(); if (b.right>392||b.left<-2) out.push(e.tagName+"."+String(e.className).slice(0,50)+" l="+Math.round(b.left)+" r="+Math.round(b.right)); }
  return {iw:innerWidth, out:out.slice(0,10)};
});
console.log(JSON.stringify(r2,null,1));
await browser.close();
