import { launch } from "./harness.mjs";
const { browser, page } = await launch({ dark: true });
console.log(await page.evaluate(() => { const cs=getComputedStyle(document.documentElement); const b=getComputedStyle(document.body); const r=document.querySelector("#root > div"); return JSON.stringify({theme:document.documentElement.dataset.theme, cbg:cs.getPropertyValue("--c-bg"), canvas:cs.getPropertyValue("--canvas"), body:b.backgroundColor, root:r&&getComputedStyle(r).backgroundColor, cls:r&&r.className}); }));
await browser.close();
