import { launch } from "./harness.mjs";
for (const [tag, dark, w, h] of [["m-l", false, 390, 844], ["d-l", false, 1366, 860], ["m-d", true, 390, 844]]) {
  const { browser, page, shot, errors } = await launch({ dark, w, h });
  await page.waitForTimeout(800);
  await shot(`home-${tag}`);
  await page.getByRole("button", { name: /Insights/ }).click();
  await page.waitForTimeout(900);
  await shot(`ins-${tag}`);
  console.log(tag, errors.filter(e=>!/same key/.test(e)));
  await browser.close();
}
