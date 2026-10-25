const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const chromePath = path.join(
  process.env.LOCALAPPDATA,
  'Google',
  'Chrome',
  'Application',
  'chrome.exe'
);

const artifactsDir = path.join(
  process.env.USERPROFILE,
  '.gemini',
  'antigravity-ide',
  'brain',
  'b030c6ec-77b6-4217-bffb-a48d3b25e3df'
);

async function runBlackBoxTest() {
  console.log('===============================================================');
  console.log('  BLACK-BOX TEST: EXPLORE DIRECTIONS LOCATION PROMPT & SEARCH');
  console.log('===============================================================\n');

  console.log(`[1] Launching Chrome from: ${chromePath}`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--window-size=1280,850',
    ],
  });

  const context = browser.defaultBrowserContext();
  // Explicitly deny geolocation so browser does not have user location
  await context.overridePermissions('http://localhost:3000', []);

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Error') || text.includes('fetchRoute') || text.includes('API')) {
      console.log('  [Browser Console]:', text);
    }
  });

  try {
    const targetUrl = 'http://localhost:3000/explore?destLat=15.2993&destLng=74.124&destName=Goa&directions=true';
    console.log(`[2] Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('[3] Waiting for RouteCard to render...');
    await page.waitForSelector('[role="region"][aria-label="Route directions and information"]', {
      timeout: 10000,
    });
    console.log('✓ RouteCard region found in DOM!');

    // Check 1: Verify "New Delhi" is NOT in the RouteCard
    const routeCardText = await page.$eval(
      '[role="region"][aria-label="Route directions and information"]',
      (el) => el.innerText
    );
    console.log('\n--- RouteCard Current Text Content ---');
    console.log(routeCardText.trim());
    console.log('--------------------------------------\n');

    if (routeCardText.includes('From: New Delhi')) {
      throw new Error('FAIL: "From: New Delhi" is still shown in the RouteCard!');
    }
    console.log('✓ PASS: "From: New Delhi" is NOT present!');

    // Check 2: Verify "Location Access Needed" is displayed
    if (!routeCardText.includes('Location Access Needed')) {
      throw new Error('FAIL: "Location Access Needed" banner is missing!');
    }
    console.log('✓ PASS: "Location Access Needed" banner is displayed!');

    // Check 3: Verify "Turn On Location (Use GPS)" button exists
    const gpsBtn = await page.$('#btn-turn-on-location');
    if (!gpsBtn) {
      throw new Error('FAIL: #btn-turn-on-location button not found!');
    }
    console.log('✓ PASS: "Turn On Location (Use GPS)" button is present!');

    // Check 4: Verify search input exists
    const searchInput = await page.$('#input-search-origin-fallback');
    if (!searchInput) {
      throw new Error('FAIL: #input-search-origin-fallback input not found!');
    }
    console.log('✓ PASS: Starting location search input is present!');

    // Save initial screenshot
    const screenshot1Path = path.join(artifactsDir, 'test_1_location_prompt_initial.png');
    await page.screenshot({ path: screenshot1Path });
    console.log(`✓ Saved initial screenshot to: ${screenshot1Path}`);

    // Action: Type "Mumbai" into search input
    console.log('\n[4] Typing "Mumbai" into starting location input...');
    await page.click('#input-search-origin-fallback');
    await page.type('#input-search-origin-fallback', 'Mumbai', { delay: 100 });

    console.log('[5] Waiting for autocomplete suggestions dropdown...');
    await page.waitForSelector('button[data-testid="origin-suggestion-item"]', { timeout: 8000 });
    console.log('✓ Suggestions list loaded with items!');

    // Click the Mumbai suggestion
    console.log('[6] Selecting Mumbai from suggestions...');
    await page.click('button[data-testid="origin-suggestion-item"]');

    console.log('[7] Waiting for route calculation from Mumbai to Goa...');
    await page.waitForFunction(
      () => {
        const card = document.querySelector('[role="region"][aria-label="Route directions and information"]');
        return card && card.innerText.includes('From:') && card.innerText.includes('Mumbai');
      },
      { timeout: 12000 }
    );
    console.log('✓ PASS: Origin successfully updated to Mumbai ("From: Mumbai")!');

    // Wait for distance & duration text
    await page.waitForFunction(
      () => {
        const card = document.querySelector('[role="region"][aria-label="Route directions and information"]');
        return card && (card.innerText.includes('km') || card.innerText.includes('Fastest'));
      },
      { timeout: 10000 }
    );
    console.log('✓ PASS: Route distance and duration calculated and displayed!');

    // Verify swap button and GPS button are visible
    const swapBtn = await page.$('#route-card-swap-btn');
    const quickGpsBtn = await page.$('#route-card-gps-btn');
    if (swapBtn) console.log('✓ PASS: Route Swap button is visible!');
    if (quickGpsBtn) console.log('✓ PASS: Route GPS quick button is visible!');

    // Save final route screenshot
    const screenshot2Path = path.join(artifactsDir, 'test_2_mumbai_to_goa_route.png');
    await page.screenshot({ path: screenshot2Path });
    console.log(`✓ Saved final route screenshot to: ${screenshot2Path}`);

    const finalCardText = await page.$eval(
      '[role="region"][aria-label="Route directions and information"]',
      (el) => el.innerText
    );
    console.log('\n--- Final RouteCard State ---');
    console.log(finalCardText.trim());
    console.log('-----------------------------\n');

    console.log('🎉 ALL BLACK-BOX TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Black-box test failed:', err);
    const errPath = path.join(artifactsDir, 'test_failure_screenshot.png');
    await page.screenshot({ path: errPath });
    console.log(`Saved failure screenshot to: ${errPath}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runBlackBoxTest();
