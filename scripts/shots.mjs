/**
 * Captures the product screenshots used on the landing page.
 *
 * These are photographs of the real editor, not mockups — run it again after
 * any UI change so the marketing page never drifts from the product.
 *
 *   node scripts/shots.mjs            (needs the dev server on :3100)
 */
import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3100";
const OUT = "public/shots";
const CHROME =
  process.env.CHROME_PATH ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Clicks the first element whose trimmed text matches exactly. */
async function clickText(page, text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button, [role=tab], a")].find(
      (e) => e.textContent?.trim() === t,
    );
    if (!el) return false;
    el.click();
    return true;
  }, text);
  if (!ok) throw new Error(`No clickable element with text "${text}"`);
  await wait(400);
}

/**
 * The screen content for the mockups. Rendering it here keeps the shots
 * self-contained — no binary fixture to keep in the repo.
 */
const SAMPLE_UI = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1440px;height:900px;background:#0c0d10;color:#e7e9ee;
  font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;display:flex}
.side{width:230px;border-right:1px solid #1c1f26;padding:20px 14px;background:#0a0b0e}
.brand{display:flex;align-items:center;gap:9px;font-weight:650;margin-bottom:26px;font-size:15px}
.dot{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#6366f1,#22d3ee)}
.nav{display:flex;flex-direction:column;gap:3px}
.nav div{padding:8px 11px;border-radius:8px;color:#8b93a3;font-size:13.5px}
.nav div.on{background:#16181f;color:#fff}
.main{flex:1;padding:26px 30px;overflow:hidden}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
h1{font-size:24px;font-weight:650;letter-spacing:-.02em}
.btn{background:#4f46e5;color:#fff;padding:8px 15px;border-radius:9px;font-size:13px;font-weight:550}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:22px}
.card{background:#101218;border:1px solid #1c1f26;border-radius:13px;padding:16px}
.k{color:#8b93a3;font-size:12px}
.v{font-size:27px;font-weight:650;margin-top:6px;letter-spacing:-.02em}
.up{color:#34d399;font-size:12px;margin-top:5px}
.panel{background:#101218;border:1px solid #1c1f26;border-radius:13px;padding:18px}
.chart{height:190px;display:flex;align-items:flex-end;gap:11px;margin-top:16px}
.bar{flex:1;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#6366f1,#4338ca)}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
td,th{text-align:left;padding:9px 4px;border-bottom:1px solid #1a1d24}
th{color:#8b93a3;font-weight:500;font-size:12px}
.pill{background:#132a20;color:#34d399;padding:2px 9px;border-radius:99px;font-size:11.5px}
.av{width:24px;height:24px;border-radius:99px;background:linear-gradient(135deg,#f472b6,#7c3aed);
  display:inline-block;vertical-align:-7px;margin-right:9px}
</style></head><body>
<div class="side">
  <div class="brand"><span class="dot"></span>Northwind</div>
  <div class="nav">
    <div class="on">Overview</div><div>Customers</div><div>Invoices</div>
    <div>Products</div><div>Reports</div><div>Settings</div>
  </div>
</div>
<div class="main">
  <div class="top"><h1>Overview</h1><span class="btn">New invoice</span></div>
  <div class="cards">
    <div class="card"><div class="k">Revenue</div><div class="v">$48,290</div><div class="up">↑ 12.4% this month</div></div>
    <div class="card"><div class="k">Active customers</div><div class="v">1,284</div><div class="up">↑ 3.1% this month</div></div>
    <div class="card"><div class="k">Avg. invoice</div><div class="v">$376</div><div class="up">↑ 8.0% this month</div></div>
  </div>
  <div class="panel">
    <div style="font-weight:600">Revenue by month</div>
    <div class="chart">
      ${[38, 52, 44, 66, 58, 79, 71, 88, 76, 94, 85, 100]
        .map((h) => `<div class="bar" style="height:${h}%"></div>`)
        .join("")}
    </div>
    <table>
      <tr><th>Customer</th><th>Invoice</th><th>Amount</th><th>Status</th></tr>
      <tr><td><span class="av"></span>Acme Supply</td><td>INV-2041</td><td>$1,280</td><td><span class="pill">Paid</span></td></tr>
      <tr><td><span class="av"></span>Beacon Labs</td><td>INV-2040</td><td>$940</td><td><span class="pill">Paid</span></td></tr>
    </table>
  </div>
</div></body></html>`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--hide-scrollbars", "--force-device-scale-factor=2"],
});

try {
  await mkdir(OUT, { recursive: true });

  // 1. The screen content that goes inside the device.
  const sample = await browser.newPage();
  await sample.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await sample.setContent(SAMPLE_UI, { waitUntil: "load" });
  await sample.screenshot({ path: `${OUT}/sample-ui.png` });
  await sample.close();
  console.log("✓ sample-ui.png");

  // 2. The editor, holding that content.
  const page = await browser.newPage();
  await page.setViewport({ width: 1560, height: 940, deviceScaleFactor: 2 });
  // /editor with nothing saved bounces to the chooser, so start a project the
  // way a person would rather than deep-linking into an empty editor.
  await page.goto(`${BASE}/projects`, { waitUntil: "domcontentloaded" });
  await wait(2500);
  await clickText(page, "New project");
  await wait(2500);
  // The dev-server badge is not part of the product.
  await page.addStyleTag({
    content:
      "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}",
  });

  const input = await page.$('input[type="file"]');
  await input.uploadFile(`${OUT}/sample-ui.png`);
  await wait(1800);

  // The MacBook artwork is the best-looking frame we have, so it is what the
  // landing page should be showing.
  await clickText(page, "Device");
  await clickText(page, "MacBook");
  // Bitmap artwork is a file: give it a moment to arrive before capturing.
  await wait(1200);

  // The default graphite is nearly black, which photographs as an empty
  // rectangle. A lit background shows what the tool actually does.
  await clickText(page, "Scene");
  await wait(400);
  // Shaders live behind their own type now, not in the colour presets.
  await clickText(page, "shader");
  await wait(400);
  await clickText(page, "Aurora");
  // The shader compiles and paints on the first frame after the click.
  await wait(1400);

  await clickText(page, "Animation");
  await wait(400);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find((b) =>
      /Tilt|Float|Rise|Fly/i.test(b.textContent ?? ""),
    );
    el?.click();
  });
  await wait(1500);

  await page.screenshot({ path: `${OUT}/editor.png` });
  console.log("✓ editor.png");

  // 3. The recording screen — its own route now, not a panel in the editor.
  await page.goto(`${BASE}/record`, { waitUntil: "domcontentloaded" });
  await wait(2000);
  await page.addStyleTag({
    content:
      "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}",
  });
  await page.screenshot({ path: `${OUT}/record.png` });
  console.log("✓ record.png");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await wait(2500);

  // 4. The export dialog.
  await clickText(page, "Export");
  await wait(900);
  await page.screenshot({ path: `${OUT}/export.png` });
  console.log("✓ export.png");

  await writeFile(
    `${OUT}/README.md`,
    "Generated by `node scripts/shots.mjs`. Do not edit by hand — re-run it\nafter a UI change so the landing page stays honest.\n",
  );
} finally {
  await browser.close();
}
