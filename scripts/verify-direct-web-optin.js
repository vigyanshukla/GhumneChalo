const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function run() {
  const chromePath = 'C:\\Users\\manis\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
  const outDir = path.join(process.cwd(), 'docs', 'screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Launching Chrome from:', chromePath);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

  // Fill in credentials
  await page.type('#login-email-input', 'traveler@ghumnechalo.com');
  await page.type('#login-password-input', 'Password123!');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  console.log('Logged in. Navigating to /notifications...');

  await page.goto('http://localhost:3000/notifications', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:3000', ['notifications']);

  const bannerShot = path.join(outDir, 'direct-web-optin-banner.png');
  await page.screenshot({ path: bannerShot, fullPage: false });
  console.log('Captured direct web opt-in banner:', bannerShot);

  // Click "Turn On Direct Web Alerts" button
  console.log('Clicking Turn On Direct Web Alerts...');
  const optInBtn = await page.$('#enable-web-notifications-btn');
  if (optInBtn) {
    await optInBtn.click();
    await new Promise((r) => setTimeout(r, 4000));
  }

  // Capture Active state
  const activeShot = path.join(outDir, 'direct-web-optin-active-state.png');
  await page.screenshot({ path: activeShot, fullPage: false });
  console.log('Captured active state:', activeShot);

  // Click Send Live Test Alert
  const testAlertBtn = await page.$('#banner-test-push-btn');
  if (testAlertBtn) {
    console.log('Clicking Send Live Test Alert...');
    await testAlertBtn.click();
    await new Promise((r) => setTimeout(r, 3000));
    const testDispatchedShot = path.join(outDir, 'direct-web-test-dispatched.png');
    await page.screenshot({ path: testDispatchedShot, fullPage: false });
    console.log('Captured test alert dispatched:', testDispatchedShot);
  }

  // Mobile viewport verification (390x844)
  console.log('Switching to mobile viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 1500));

  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log('Mobile horizontal overflow:', hasOverflow ? 'FAILED' : 'PASS (No overflow)');
  if (hasOverflow) throw new Error('Horizontal overflow detected on mobile!');

  const mobileShot = path.join(outDir, 'web-push-mobile.png');
  await page.screenshot({ path: mobileShot, fullPage: false });
  console.log('Captured mobile screenshot:', mobileShot);

  await browser.close();
  console.log('Verification completed successfully.');
}

run().catch((err) => {
  console.error('Error during browser verification:', err);
  process.exit(1);
});
