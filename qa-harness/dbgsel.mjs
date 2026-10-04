import { launch } from "./harness.mjs";
const { browser, page } = await launch({ dark:false, w:390, h:844 });
await page.waitForTimeout(900);
const before = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, iw:innerWidth, sx:scrollX}));
await page.locator(".ps-div-icon").first().click({ force:true });
await page.waitForTimeout(1400);
const after = await page.evaluate(()=>{
  const wide=[...document.querySelectorAll("body *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>e.tagName+"."+String(e.className).slice(0,60)+" r="+Math.round(e.getBoundingClientRect().right));
  return {sw:document.documentElement.scrollWidth, iw:innerWidth, sx:scrollX, wide};
});
console.log(JSON.stringify({before,after},null,1));
await browser.close();
