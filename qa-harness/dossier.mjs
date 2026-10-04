import { launch } from "./harness.mjs";
const cfgs = [["m-light",{}],["m-dark",{dark:true}],["d-light",{w:1440,h:900}],["d-dark",{w:1440,h:900,dark:true}]];
for (const [tag, opts] of cfgs) {
  const { browser, page, shot, errors } = await launch(opts);
  await page.locator("button:has-text('QA Fixture · Mulshi')").first().click();
  await page.waitForTimeout(900);
  await shot(`dos-${tag}-top`);
  if (tag.startsWith("m")) {
    await page.evaluate(() => window.scrollTo(0, 520)); await shot(`dos-${tag}-scroll1`);
    await page.evaluate(() => window.scrollTo(0, 1500)); await shot(`dos-${tag}-scroll2`);
  } else {
    await page.evaluate(() => window.scrollTo(0, 700)); await shot(`dos-${tag}-scroll1`);
  }
  console.log(tag, errors.filter(e=>!/same key/.test(e)).slice(0,3));
  await browser.close();
}
