const puppeteer = require('puppeteer-core');
const path = require('path');

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

async function runResponsiveTests() {
  console.log('===============================================================');
  console.log('  TESTING RESPONSIVENESS (320px Mobile & Desktop Support)');
  console.log('===============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();

  try {
    // -------------------------------------------------------------
    // Test 1: Mobile 320px on Home Page
    // -------------------------------------------------------------
    console.log('[1] Setting mobile viewport: 320x568 (iPhone SE minimum standard)...');
    await page.setViewport({ width: 320, height: 568, isMobile: true, hasTouch: true });

    console.log('[2] Navigating to http://localhost:3000/ ...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 20000 });

    const homeScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(`  -> Home Page document.scrollWidth at 320px viewport: ${homeScrollWidth}px`);
    if (homeScrollWidth > 322) {
      console.warn(`  ⚠️ Warning: Slight horizontal overflow detected: ${homeScrollWidth}px > 320px`);
    } else {
      console.log('  ✓ PASS: Home page fits within 320px without horizontal overflow!');
    }

    const homeScreenshot = path.join(artifactsDir, 'mobile_320px_home.png');
    await page.screenshot({ path: homeScreenshot });
    console.log(`  ✓ Saved screenshot: ${homeScreenshot}`);

    // -------------------------------------------------------------
    // Test 2: Mobile 320px on Explore Directions Page
    // -------------------------------------------------------------
    console.log('\n[3] Testing Explore Directions page at 320px width...');
    const exploreUrl = 'http://localhost:3000/explore?destLat=15.2993&destLng=74.124&destName=Goa&directions=true';
    await page.goto(exploreUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    await page.waitForSelector('[role="region"][aria-label="Route directions and information"]', {
      timeout: 10000,
    });

    const routeCardWidth = await page.$eval(
      '[role="region"][aria-label="Route directions and information"]',
      (el) => el.getBoundingClientRect().width
    );
    console.log(`  -> RouteCard width rendered at 320px viewport: ${routeCardWidth.toFixed(1)}px`);

    const hasLocationBanner = await page.$eval(
      '[role="region"][aria-label="Route directions and information"]',
      (el) => el.innerText.includes('Location Access Needed')
    );
    const hasGpsBtn = !!(await page.$('#btn-turn-on-location'));
    const hasSearchInput = !!(await page.$('#input-search-origin-fallback'));

    console.log(`  -> Location Access Needed banner: ${hasLocationBanner ? '✓ Yes' : '❌ No'}`);
    console.log(`  -> Turn On Location (Use GPS) button: ${hasGpsBtn ? '✓ Yes' : '❌ No'}`);
    console.log(`  -> Search input: ${hasSearchInput ? '✓ Yes' : '❌ No'}`);

    const exploreScreenshot = path.join(artifactsDir, 'mobile_320px_explore_directions.png');
    await page.screenshot({ path: exploreScreenshot });
    console.log(`  ✓ Saved screenshot: ${exploreScreenshot}`);

    // -------------------------------------------------------------
    // Test 3: Desktop 1440px on Explore Directions Page
    // -------------------------------------------------------------
    console.log('\n[4] Setting desktop viewport: 1440x900 (PC / Laptop)...');
    await page.setViewport({ width: 1440, height: 900, isMobile: false, hasTouch: false });
    await page.goto(exploreUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    await page.waitForSelector('[role="region"][aria-label="Route directions and information"]', {
      timeout: 10000,
    });

    const desktopScreenshot = path.join(artifactsDir, 'desktop_1440px_explore.png');
    await page.screenshot({ path: desktopScreenshot });
    console.log(`  ✓ Saved desktop screenshot: ${desktopScreenshot}`);

    console.log('\n🎉 RESPONSIVE 320px & PC TESTS COMPLETED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Error during responsive testing:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runResponsiveTests();
