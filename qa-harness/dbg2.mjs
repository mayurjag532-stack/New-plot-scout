import { launch } from "./harness.mjs";
const { browser, page } = await launch({});
await page.locator("button:has-text('QA Fixture · Mulshi')").first().click();
await page.waitForTimeout(900);
console.log(await page.evaluate(() => { const r=(s)=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return [Math.round(b.left),Math.round(b.right),Math.round(b.width)]}; return JSON.stringify({sw:document.documentElement.scrollWidth, iw:innerWidth, head:r(".ps-dhead"), back:r(".ps-dhead-btn"), title:r(".ps-dhead-title"), actions:r(".ps-dhead-actions"), sheet:r(".ps-dsheet"), nav:r(".ps-dnav"), track:r(".ps-dnav-track")}); }));
await browser.close();
