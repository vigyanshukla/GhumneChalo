import puppeteer from 'puppeteer-core';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://localhost:3000';

const PAGES_TO_TEST = [
  { path: '/', name: 'Home / Landing' },
  { path: '/explore', name: 'Explore Places' },
  { path: '/trips', name: 'Trips Dashboard' },
  { path: '/emergency', name: 'Emergency Mode' },
  { path: '/achievements', name: 'Achievements' },
  { path: '/reminders', name: 'Reminders' },
  { path: '/notifications', name: 'Notifications' },
  { path: '/login', name: 'Login' }
];

const VIEWPORTS = [
  { name: 'Desktop', width: 1440, height: 900, isMobile: false },
  { name: 'Mobile', width: 390, height: 844, isMobile: true }
];

async function measurePage(browser, pageConfig, viewport) {
  const page = await browser.newPage();
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    isMobile: viewport.isMobile
  });

  const networkRequests = [];
  let jsTransferred = 0;
  let cssTransferred = 0;
  let imgTransferred = 0;
  let fontTransferred = 0;
  let apiRequestsCount = 0;

  page.on('response', async (res) => {
    try {
      const url = res.url();
      const status = res.status();
      const headers = res.headers();
      const length = parseInt(headers['content-length'] || '0', 10);
      const contentType = headers['content-type'] || '';

      const reqType = res.request().resourceType();
      networkRequests.push({ url, status, reqType, length, contentType });

      if (reqType === 'script' || url.endsWith('.js') || contentType.includes('javascript')) {
        jsTransferred += length;
      } else if (reqType === 'stylesheet' || url.endsWith('.css') || contentType.includes('css')) {
        cssTransferred += length;
      } else if (reqType === 'image' || contentType.includes('image')) {
        imgTransferred += length;
      } else if (reqType === 'font' || contentType.includes('font') || url.includes('.woff')) {
        fontTransferred += length;
      }

      if (url.includes('/api/')) {
        apiRequestsCount++;
      }
    } catch {
      // ignore closed connections
    }
  });

  // Evaluate web vitals
  await page.evaluateOnNewDocument(() => {
    window.__perf = {
      fcp: 0,
      lcp: 0,
      cls: 0,
      longTasks: 0,
      tbt: 0
    };

    const poFcp = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntriesByName('first-contentful-paint')) {
        window.__perf.fcp = entry.startTime;
      }
    });
    try { poFcp.observe({ type: 'paint', buffered: true }); } catch {}

    const poLcp = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length > 0) {
        window.__perf.lcp = entries[entries.length - 1].startTime;
      }
    });
    try { poLcp.observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}

    const poCls = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__perf.cls += entry.value;
        }
      }
    });
    try { poCls.observe({ type: 'layout-shift', buffered: true }); } catch {}

    const poLt = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const blockingTime = entry.duration - 50;
        if (blockingTime > 0) {
          window.__perf.tbt += blockingTime;
        }
      }
    });
    try { poLt.observe({ type: 'longtask', buffered: true }); } catch {}
  });

  const navStart = Date.now();
  await page.goto(`${BASE_URL}${pageConfig.path}`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  const totalLoadTime = Date.now() - navStart;

  // Let observers settle
  await new Promise((r) => setTimeout(r, 1000));

  const navTiming = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    return {
      ttfb: Math.round((nav.responseStart || 0) - (nav.requestStart || 0)),
      domInteractive: Math.round(nav.domInteractive || 0),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      loadEvent: Math.round(nav.loadEventEnd || 0),
      perf: window.__perf || {}
    };
  });

  // Check horizontal overflow (crucial for mobile)
  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });

  await page.close();

  return {
    path: pageConfig.path,
    name: pageConfig.name,
    viewport: viewport.name,
    dimensions: `${viewport.width}x${viewport.height}`,
    totalLoadTime,
    ttfb: navTiming.ttfb,
    fcp: Math.round(navTiming.perf.fcp || 0),
    lcp: Math.round(navTiming.perf.lcp || 0),
    tbt: Math.round(navTiming.perf.tbt || 0),
    cls: parseFloat((navTiming.perf.cls || 0).toFixed(4)),
    domInteractive: navTiming.domInteractive,
    domContentLoaded: navTiming.domContentLoaded,
    requestsCount: networkRequests.length,
    apiRequestsCount,
    jsTransferredBytes: jsTransferred,
    cssTransferredBytes: cssTransferred,
    imgTransferredBytes: imgTransferred,
    fontTransferredBytes: fontTransferred,
    hasHorizontalScroll
  };
}

async function measureApiEndpoints() {
  const endpoints = [
    { url: `${BASE_URL}/api/places/search?query=Delhi`, name: 'Places Search' },
    { url: `${BASE_URL}/api/weather?latitude=28.6139&longitude=77.2090`, name: 'Weather API' },
    { url: `${BASE_URL}/api/notifications/unread-count`, name: 'Unread Notifications (401 expected unauth)' },
    { url: `${BASE_URL}/api/trips`, name: 'Trips List (401 expected unauth)' },
    { url: `${BASE_URL}/api/achievements`, name: 'Achievements Catalog' },
    { url: `${BASE_URL}/api/emergency/contacts`, name: 'Emergency Contacts' }
  ];

  const results = [];
  for (const ep of endpoints) {
    const t0 = performance.now();
    try {
      const res = await fetch(ep.url);
      const elapsed = Math.round(performance.now() - t0);
      const body = await res.text();
      results.push({
        name: ep.name,
        url: ep.url,
        status: res.status,
        latencyMs: elapsed,
        responseSize: body.length
      });
    } catch (e) {
      results.push({
        name: ep.name,
        url: ep.url,
        status: 'error',
        latencyMs: Math.round(performance.now() - t0),
        error: e.message
      });
    }
  }
  return results;
}

async function run() {
  console.log('Starting Phase 12A Baseline Performance Audit against production build...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const pageMetrics = [];

  for (const vp of VIEWPORTS) {
    console.log(`\nAuditing in ${vp.name} (${vp.width}x${vp.height})...`);
    for (const p of PAGES_TO_TEST) {
      process.stdout.write(`  Measuring ${p.name} (${p.path})... `);
      try {
        const m = await measurePage(browser, p, vp);
        pageMetrics.push(m);
        console.log(`FCP: ${m.fcp}ms | LCP: ${m.lcp}ms | TBT: ${m.tbt}ms | Req: ${m.requestsCount} | JS: ${Math.round(m.jsTransferredBytes / 1024)}KB`);
      } catch (err) {
        console.log(`ERROR: ${err.message}`);
      }
    }
  }

  await browser.close();

  console.log('\nMeasuring API endpoints...');
  const apiMetrics = await measureApiEndpoints();
  for (const a of apiMetrics) {
    console.log(`  ${a.name}: ${a.latencyMs}ms (HTTP ${a.status}, ${a.responseSize} bytes)`);
  }

  const baselineData = {
    timestamp: new Date().toISOString(),
    pages: pageMetrics,
    apis: apiMetrics
  };

  fs.writeFileSync('scripts/baseline-results.json', JSON.stringify(baselineData, null, 2));
  console.log('\nBaseline audit saved to scripts/baseline-results.json');
}

run().catch(console.error);
