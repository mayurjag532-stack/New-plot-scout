import { launch } from "./harness.mjs";
const { browser, page } = await launch({});
await page.locator("button:has-text('QA Fixture · Mulshi')").first().click();
await page.waitForTimeout(900);
console.log(await page.evaluate(() => { const out=[]; document.querySelectorAll("body *").forEach(e=>{const b=e.getBoundingClientRect(); if(b.right>400 && b.width>0 && getComputedStyle(e).position!=="fixed") out.push([e.tagName, (e.className+"").slice(0,60), Math.round(b.left), Math.round(b.right)]);}); return JSON.stringify(out.slice(0,12)); }));
await browser.close();
