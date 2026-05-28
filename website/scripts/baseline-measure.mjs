import { chromium } from 'playwright';

const URL = 'https://www.lslcalculator.com.au';
const RUNS = 3;

async function measureOnce() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Set up perf observers before navigation
  await page.addInitScript(() => {
    window.__perfMetrics = { fcp: null, cls: 0, lcp: null };
    new PerformanceObserver((entryList) => {
      for (const e of entryList.getEntries()) {
        if (e.name === 'first-contentful-paint') {
          window.__perfMetrics.fcp = e.startTime;
        }
      }
    }).observe({ type: 'paint', buffered: true });

    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const e of entryList.getEntries()) {
        if (!e.hadRecentInput) clsValue += e.value;
      }
      window.__perfMetrics.cls = clsValue;
    }).observe({ type: 'layout-shift', buffered: true });

    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__perfMetrics.lcp = last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  // Let CLS / LCP settle
  await page.waitForTimeout(2500);
  const metrics = await page.evaluate(() => window.__perfMetrics);
  const loadMs = Date.now() - t0;
  await browser.close();
  return { ...metrics, loadMs };
}

const results = [];
for (let i = 0; i < RUNS; i++) {
  const m = await measureOnce();
  results.push(m);
  console.log(`Run ${i + 1}:`, m);
}

const fcps = results.map(r => r.fcp).filter(v => v != null);
const clss = results.map(r => r.cls);
const lcps = results.map(r => r.lcp).filter(v => v != null);

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

console.log('\n=== SUMMARY ===');
console.log('FCP (ms):', fcps, '— median:', median(fcps).toFixed(0));
console.log('CLS:', clss, '— median:', median(clss).toFixed(4));
console.log('LCP (ms):', lcps, '— median:', median(lcps).toFixed(0));
