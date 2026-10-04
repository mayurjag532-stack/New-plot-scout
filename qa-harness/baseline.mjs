import { launch } from "./harness.mjs";
const run = async (tag, opts) => {
  const { browser, page, shot, errors } = await launch(opts);
  await shot(`${tag}-home`);
  await page.locator("button:has-text('QA Fixture · Mulshi')").first().click().catch(()=>{});
  await shot(`${tag}-open`);
  console.log(tag, errors.slice(0,3));
  await browser.close();
};
await run("base-m-light", { });
await run("base-m-dark", { dark: true });
await run("base-d-light", { w: 1440, h: 900 });
await run("base-d-dark", { w: 1440, h: 900, dark: true });
