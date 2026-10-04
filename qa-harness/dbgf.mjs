import { launch } from "./harness.mjs";
const { browser, page, shot } = await launch({ dark:false, w:390, h:844 });
await page.waitForTimeout(1200);
const r = await page.evaluate(()=>{ const b=[...document.querySelectorAll("button")].find(x=>/Filter & sort/.test(x.textContent)); const bb=b.getBoundingClientRect(); const top=document.elementFromPoint(bb.x+bb.width/2, bb.y+bb.height/2); return {y:bb.y, h:bb.height, top: top&&top.tagName+"."+String(top.className).slice(0,60), sy:scrollY, sh:document.documentElement.scrollHeight}; });
console.log(JSON.stringify(r));
await shot("dbgf");
try { await page.getByRole("button",{name:/Filter & sort/}).click({timeout:5000}); console.log("clicked"); } catch(e){ console.log("fail", String(e).slice(0,200)); }
await browser.close();
