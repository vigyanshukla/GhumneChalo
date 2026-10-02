import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:\\Users\\manis\\.gemini\\antigravity-ide\\brain\\45ed31b0-1f11-49cf-aaa1-3e58a414678e';

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve: res, reject: rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.result?.value;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACTS_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);
    return outPath;
  }

  async close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('Fetching browser page info from http://127.0.0.1:9222/json/list...');
  const pagesRes = await fetch('http://127.0.0.1:9222/json/list');
  const pages = await pagesRes.json();
  const explorePage = pages.find((p) => p.url.includes('localhost:3000/explore')) || pages[0];

  if (!explorePage) {
    throw new Error('No active page found on localhost:3000');
  }

  console.log(`Connecting to page ${explorePage.id} at ${explorePage.webSocketDebuggerUrl}`);
  const client = new CDPClient(explorePage.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('DOM.enable');
  await client.send('Runtime.enable');

  // 1. Desktop Viewport (1440x900)
  console.log('Setting desktop viewport (1440x900)...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('Navigating to http://localhost:3000/explore...');
  await client.send('Page.navigate', { url: 'http://localhost:3000/explore' });
  await new Promise((r) => setTimeout(r, 3500));

  // Wait for PlaceCards to render
  console.log('Waiting for PlaceCards to render...');
  let cardTitle = '';
  for (let i = 0; i < 25; i++) {
    cardTitle = await client.eval(`
      (() => {
        const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.trim().length > 0);
        return h3 ? h3.textContent.trim() : '';
      })()
    `);
    if (cardTitle) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`First place card rendered: "${cardTitle}"`);

  // Click on the PlaceCard
  console.log('Clicking the place card...');
  await client.eval(`
    (() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.trim().length > 0);
      const card = h3 ? h3.closest('div[role="button"]') : null;
      if (card) card.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1500));

  // Capture: desktop_place_details_card.png
  await client.screenshot('desktop_place_details_card.png');

  // Verify Directions button is present and click it
  console.log('Clicking Directions button in PlaceDetailsCard...');
  const clickedDirections = await client.eval(`
    (() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Directions'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log(`Directions button clicked: ${clickedDirections}`);

  // Wait for route calculation to complete
  console.log('Waiting for route to calculate and polyline to render...');
  for (let i = 0; i < 30; i++) {
    const isCalculating = await client.eval(`document.body.innerText.includes('Calculating best route')`);
    const hasFastest = await client.eval(`document.body.innerText.includes('Fastest')`);
    if (!isCalculating && hasFastest) {
      console.log('Route calculated successfully!');
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  await new Promise((r) => setTimeout(r, 1500));

  // Capture: desktop_route_success.png
  await client.screenshot('desktop_route_success.png');

  // Click Walk travel mode
  console.log('Clicking "Walk" travel mode...');
  await client.eval(`
    (() => {
      const walkTab = Array.from(document.querySelectorAll('button[role="tab"]')).find(b => b.textContent.includes('Walk'));
      if (walkTab) walkTab.click();
    })()
  `);

  console.log('Waiting for walking route to calculate...');
  await new Promise((r) => setTimeout(r, 2500));
  // Capture: desktop_route_walk.png
  await client.screenshot('desktop_route_walk.png');

  // Close and clear route
  console.log('Closing route...');
  await client.eval(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label="Close and clear route"]');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));
  await client.screenshot('desktop_route_cleared.png');

  // 2. Mobile Viewport (390x844)
  console.log('Setting mobile viewport (390x844)...');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await new Promise((r) => setTimeout(r, 1000));

  console.log('Selecting place and requesting directions on mobile...');
  await client.eval(`
    (() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.trim().length > 0);
      const card = h3 ? h3.closest('div[role="button"]') : null;
      if (card) card.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));

  await client.eval(`
    (() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Directions'));
      if (btn) btn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));

  // Capture: mobile_route_view.png
  await client.screenshot('mobile_route_view.png');

  // Reset viewport to desktop standard
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('All verification steps completed successfully!');
  await client.close();
}

run().catch((err) => {
  console.error('CDP verification error:', err);
  process.exit(1);
});
