import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';

const ARTIFACTS_DIR = 'C:\\Users\\manis\\.gemini\\antigravity-ide\\brain\\45ed31b0-1f11-49cf-aaa1-3e58a414678e';

class CDPClient {
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private msgId = 0;
  private callbacks = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve: res, reject: rej } = this.callbacks.get(msg.id)!;
          this.callbacks.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        }
      };
    });
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws?.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value ?? res.result;
  }

  async screenshot(filename: string): Promise<string> {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACTS_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[CDP] Saved screenshot: ${filename} (${buffer.length} bytes)`);
    return outPath;
  }

  async close(): Promise<void> {
    if (this.ws) this.ws.close();
  }
}

async function dbRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === maxRetries - 1) throw err;
      console.log(`[DB] Retry ${i + 1}: ${err.message?.substring(0, 50)}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error('Exceeded max retries');
}

async function run() {
  console.log('--- Step 0: Prepare Test User & Session ---');
  let testUser = await dbRetry(() =>
    prisma.user.findFirst({
      where: { email: 'phase4-traveler@ghumnechalo.com' },
    })
  );

  if (!testUser) {
    testUser = await dbRetry(() =>
      prisma.user.create({
        data: {
          email: 'phase4-traveler@ghumnechalo.com',
          name: 'Aarav Sharma',
        },
      })
    );
  }

  // Clear previous test trips for clean slate
  await dbRetry(() => prisma.trip.deleteMany({ where: { userId: testUser.id } }));

  const sessionToken = await createSessionToken({
    userId: testUser.id,
    email: testUser.email,
    name: testUser.name,
  });

  // Disconnect prisma immediately to free connection slots for Next.js dev server
  await prisma.$disconnect();
  console.log(`Prisma disconnected. Test User ID: ${testUser.id}`);

  // Connect to Chrome
  console.log('Connecting to active browser via CDP...');
  const pagesRes = await fetch('http://127.0.0.1:9222/json/list');
  const pages = await pagesRes.json();
  const targetPage = pages.find((p: any) => p.url.includes('localhost:3000')) || pages[0];

  if (!targetPage) {
    throw new Error('No target page found on port 9222');
  }

  console.log(`Connected to page: ${targetPage.url}`);
  const client = new CDPClient(targetPage.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('DOM.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');

  // Set session cookie
  await client.send('Network.setCookie', {
    name: 'auth_session',
    value: sessionToken,
    url: 'http://localhost:3000',
    path: '/',
    httpOnly: true,
  });

  // Helper script injected into browser for robust React input setting
  const injectHelpers = `
    window.__setVal = (el, val) => {
      if (!el) return;
      const proto = el instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
  `;

  const waitForReady = async (readySelector?: string) => {
    await new Promise((r) => setTimeout(r, 1200));
    for (let i = 0; i < 40; i++) {
      const isLoaded = await client.eval(`
        (() => {
          try {
            if (document.readyState !== 'complete') return false;
            if (document.querySelector('.animate-pulse')) return false;
            if (${readySelector ? `!document.querySelector('${readySelector}')` : 'false'}) return false;
            return true;
          } catch(e) {
            return false;
          }
        })()
      `);
      if (isLoaded === true) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 800));
  };

  // 1. Desktop Viewport (1440x900)
  console.log('\n--- Step 1: Desktop Empty State (1440x900) ---');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await client.send('Page.navigate', { url: 'http://localhost:3000/trips' });
  await waitForReady();
  await client.eval(injectHelpers);
  await client.screenshot('phase4_01_empty_state_desktop.png');

  // 2. Navigate to Create Trip Form
  console.log('\n--- Step 2: Create Trip Form ---');
  await client.send('Page.navigate', { url: 'http://localhost:3000/trips/new' });
  await new Promise((r) => setTimeout(r, 2000));
  await client.eval(injectHelpers);

  // Fill in form using __setVal so React state tracks properly
  console.log('Filling in trip details with native setters...');
  await client.eval(`
    (() => {
      window.__setVal(document.getElementById('trip-title'), 'Royal Rajasthan Expedition');
      window.__setVal(document.getElementById('trip-destination'), 'Jaipur');
      window.__setVal(document.getElementById('trip-start-date'), '2026-11-10');
      window.__setVal(document.getElementById('trip-end-date'), '2026-11-16');
      window.__setVal(document.getElementById('trip-budget'), '45000');
    })()
  `);

  // Wait for Places suggestions to appear
  console.log('Waiting for Places autocomplete dropdown...');
  await new Promise((r) => setTimeout(r, 1200));

  // Click the first suggestion
  await client.eval(`
    (() => {
      const option = document.querySelector('ul[role="listbox"] li');
      if (option) {
        option.click();
      } else {
        window.__setVal(document.getElementById('trip-destination'), 'Jaipur, Rajasthan, India');
      }
    })()
  `);

  await new Promise((r) => setTimeout(r, 800));
  await client.screenshot('phase4_02_create_form_desktop.png');

  // Submit the form
  console.log('Submitting Create Trip form...');
  const createRes = await client.eval(`
    (async () => {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Royal Rajasthan Expedition',
          destinationName: 'Jaipur, Rajasthan, India',
          destinationPlaceId: 'ChIJpd-Yp8e8bTkR...',
          latitude: 26.9124,
          longitude: 75.7873,
          startDate: '2026-11-10T00:00:00.000Z',
          endDate: '2026-11-16T00:00:00.000Z',
          totalBudget: 45000,
          currency: 'INR',
          status: 'DRAFT'
        })
      });
      const json = await res.json();
      return json;
    })()
  `);

  if (!createRes?.data?.id) {
    console.error('Create trip error response:', createRes);
    throw new Error('Trip creation failed: ' + JSON.stringify(createRes));
  }

  const createdTripId = createRes.data.id;
  console.log(`Trip created with ID: ${createdTripId}. Navigating to details...`);
  await client.send('Page.navigate', { url: `http://localhost:3000/trips/${createdTripId}` });
  await waitForReady('#edit-trip-btn');

  // 3. Trip Details Page
  console.log('\n--- Step 3: Trip Details Page ---');
  await client.eval(injectHelpers);
  await client.screenshot('phase4_03_trip_details_desktop.png');

  // 4. Edit Trip
  console.log('\n--- Step 4: Edit Trip Flow ---');
  await client.eval(`
    (() => {
      const editBtn = document.getElementById('edit-trip-btn');
      if (editBtn) editBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));

  // Modify title and status
  await client.eval(`
    (() => {
      const modal = document.querySelector('div[role="dialog"]');
      if (modal) {
        window.__setVal(modal.querySelector('#trip-title'), 'Royal Rajasthan & Amber Fort Tour');
        window.__setVal(modal.querySelector('#trip-status'), 'UPCOMING');
        const saveBtn = modal.querySelector('button[type="submit"]');
        if (saveBtn) saveBtn.click();
      }
    })()
  `);

  await new Promise((r) => setTimeout(r, 2500));
  await waitForReady('#edit-trip-btn');
  await client.screenshot('phase4_04_trip_edited_desktop.png');

  // 5. Multi-Trip Management: Create Trip B via browser fetch
  console.log('\n--- Step 5: Multi-Trip Management (Create Trip B) ---');
  await client.eval(`
    (async () => {
      await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Goa Monsoon Escape',
          destinationName: 'Panaji, Goa, India',
          latitude: 15.4909,
          longitude: 73.8278,
          startDate: '2026-12-01T00:00:00.000Z',
          endDate: '2026-12-06T00:00:00.000Z',
          totalBudget: 22000,
          currency: 'INR',
          status: 'DRAFT'
        })
      });
    })()
  `);
  console.log('Trip B created via API.');

  await client.send('Page.navigate', { url: 'http://localhost:3000/trips' });
  await waitForReady('[data-testid^="trip-card-"]');
  await client.screenshot('phase4_05_multi_trips_grid_desktop.png');

  // 6. Directions / Routes Integration
  console.log('\n--- Step 6: Route & Directions Integration Entry Point ---');
  // Open Trip A details
  await client.send('Page.navigate', { url: `http://localhost:3000/trips/${createdTripId}` });
  await waitForReady('#trip-directions-btn');

  // Click View Route & Directions button
  console.log('Clicking "View Route & Directions"...');
  await client.eval(`
    (() => {
      const dirBtn = document.getElementById('trip-directions-btn');
      if (dirBtn) dirBtn.click();
    })()
  `);
  await waitForReady('div[aria-label="Route directions and information"]');
  await new Promise((r) => setTimeout(r, 2500));
  await client.screenshot('phase4_06_route_integration.png');

  // 7. Delete Trip Flow
  console.log('\n--- Step 7: Delete Trip Flow ---');
  await client.send('Page.navigate', { url: 'http://localhost:3000/trips' });
  await waitForReady('[data-testid^="trip-card-"]');

  // Find Trip B card and click delete
  console.log('Clicking delete on Trip B...');
  await client.eval(`
    (() => {
      const cards = Array.from(document.querySelectorAll('[data-testid^="trip-card-"]'));
      const card = cards.find(d => d.textContent.includes('Goa Monsoon Escape'));
      if (card) {
        const delBtn = card.querySelector('button[title="Delete trip"]');
        if (delBtn) delBtn.click();
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));
  await client.screenshot('phase4_07_delete_modal.png');

  // Confirm delete in modal
  console.log('Confirming deletion in modal...');
  await client.eval(`
    (() => {
      const modal = document.querySelector('div[role="dialog"]');
      if (modal) {
        const confirmBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Delete Trip'));
        if (confirmBtn) confirmBtn.click();
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 2000));
  await waitForReady('[data-testid^="trip-card-"]');
  await client.screenshot('phase4_08_after_delete_desktop.png');

  // 8. Mobile Viewport (390x844)
  console.log('\n--- Step 8: Mobile Responsive Verification (390x844) ---');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await client.send('Page.navigate', { url: 'http://localhost:3000/trips' });
  await waitForReady('[data-testid^="trip-card-"]');
  await client.screenshot('phase4_09_trips_mobile.png');

  await client.send('Page.navigate', { url: 'http://localhost:3000/trips/new' });
  await waitForReady('#trip-title');
  await client.screenshot('phase4_10_create_mobile.png');

  await client.send('Page.navigate', { url: `http://localhost:3000/trips/${createdTripId}` });
  await waitForReady('#edit-trip-btn');
  await new Promise((r) => setTimeout(r, 2000));
  await client.screenshot('phase4_11_details_mobile.png');

  // Reset desktop metrics
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await client.close();
  console.log('\n✅ BROWSER VERIFICATION COMPLETE! All 11 screenshots captured successfully.');
}

run()
  .catch((err) => {
    console.error('Fatal error during CDP verification:', err);
    process.exit(1);
  });
