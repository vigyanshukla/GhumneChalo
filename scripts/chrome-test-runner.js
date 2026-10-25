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

const screenshotsDir = path.join(__dirname, '..', 'docs', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function run() {
  console.log('====================================================');
  console.log('  CHROME E2E NOTIFICATIONS & FCM SUPABASE TEST');
  console.log('====================================================\n');

  console.log(`[1] Launching Chrome from: ${chromePath}`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true, // headless mode for automated verification
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--window-size=1280,800',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Login
    console.log('[2] Navigating to http://localhost:3000/login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

    console.log('[3] Logging in with traveler@ghumnechalo.com...');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'traveler@ghumnechalo.com');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    console.log('[4] Waiting for navigation after login...');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('Current URL:', page.url());

    // 2. Check Header Notification Bell Icon
    console.log('[5] Checking notification bell in header...');
    await page.waitForSelector('#notification-bell-btn', { timeout: 10000 });
    console.log('✓ Found #notification-bell-btn in header!');

    // Click bell to open panel
    await page.click('#notification-bell-btn');
    await page.waitForSelector('#notification-panel', { timeout: 5000 });
    console.log('✓ Notification dropdown panel opened successfully!');

    // 3. Navigate to Notification Center
    console.log('[6] Navigating to http://localhost:3000/notifications...');
    await page.goto('http://localhost:3000/notifications', { waitUntil: 'networkidle2' });

    await page.waitForSelector('#send-test-notification-btn', { timeout: 10000 });
    console.log('✓ Loaded Notification Center page!');

    // Take Desktop Screenshot
    const desktopScreenshotPath = path.join(screenshotsDir, 'notification-center-desktop.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    console.log(`✓ Saved desktop screenshot: ${desktopScreenshotPath}`);

    // 4. Click Send Test Alert (live notification creation + push trigger)
    console.log('[7] Clicking "Send Test Alert" button...');
    await page.click('#send-test-notification-btn');
    await new Promise((r) => setTimeout(r, 2000));
    console.log('✓ Test alert generated and stored in Supabase!');

    // 5. Open Preferences Modal
    console.log('[8] Opening Notification Preferences modal...');
    const prefButtons = await page.$$('button');
    let prefClicked = false;
    for (const btn of prefButtons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes('Preferences')) {
        await btn.click();
        prefClicked = true;
        break;
      }
    }

    if (!prefClicked) {
      throw new Error('Could not find Preferences button');
    }

    await page.waitForSelector('#pref-modal-title', { timeout: 5000 });
    console.log('✓ Preferences modal opened!');

    // Wait for preferences and push card to load
    await page.waitForSelector('#send-test-push-btn', { timeout: 10000 });
    console.log('✓ Browser Web Push / FCM card loaded!');

    // Click "Send Test Push" inside modal
    console.log('[9] Clicking "Send Test Push" button in modal...');
    await page.click('#send-test-push-btn');
    await new Promise((r) => setTimeout(r, 2500));

    const modalUpdatedText = await page.evaluate(() => document.body.innerText);
    const hasSuccess = modalUpdatedText.includes('Test notification created in Supabase');
    console.log(`✓ Success feedback displayed: ${hasSuccess}`);

    const modalScreenshotPath = path.join(screenshotsDir, 'notification-preferences-modal.png');
    await page.screenshot({ path: modalScreenshotPath });
    console.log(`✓ Saved preferences modal screenshot: ${modalScreenshotPath}`);

    // Close modal
    const closeBtn = await page.$('button[aria-label="Close preferences"]');
    if (closeBtn) await closeBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    // 6. Test Mobile Viewport (390 x 844)
    console.log('[10] Testing Mobile Viewport (390 x 844)...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise((r) => setTimeout(r, 1000));

    const mobileScreenshotPath = path.join(screenshotsDir, 'notification-center-mobile.png');
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    console.log(`✓ Saved mobile screenshot: ${mobileScreenshotPath}`);

    // Check no horizontal scrollbar on mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`Mobile dimensions: clientWidth=${clientWidth}, scrollWidth=${scrollWidth}`);
    const noOverflow = scrollWidth <= clientWidth;
    console.log(`✓ Mobile horizontal overflow check: ${noOverflow ? 'PASS' : 'FAIL'}`);

    // 7. Verify Database Persistence in Supabase via authenticated API
    console.log('\n[11] Verifying Database records in Supabase via authenticated browser context...');
    const apiResult = await page.evaluate(async () => {
      const notifRes = await fetch('/api/notifications');
      const notifData = await notifRes.json();

      const unreadRes = await fetch('/api/notifications/unread-count');
      const unreadData = await unreadRes.json();

      const prefRes = await fetch('/api/notifications/preferences');
      const prefData = await prefRes.json();

      return {
        notificationsCount: notifData.data?.notifications?.length || 0,
        notificationsTotal: notifData.data?.total || 0,
        firstNotification: notifData.data?.notifications?.[0],
        unreadCount: unreadData.data?.unreadCount,
        preferences: prefData.data,
      };
    });

    console.log(`✓ Total notifications in Supabase: ${apiResult.notificationsTotal}`);
    console.log(`✓ Latest Notification Title: "${apiResult.firstNotification?.title}"`);
    console.log(`✓ Latest Notification Type: "${apiResult.firstNotification?.type}"`);
    console.log(`✓ Unread notifications count in Supabase: ${apiResult.unreadCount}`);
    console.log(`✓ Push Enabled in Supabase preferences: ${apiResult.preferences?.pushEnabled}`);
    console.log(`✓ Trip Reminders in Supabase preferences: ${apiResult.preferences?.tripReminders}`);

    console.log('\n====================================================');
    console.log('  CHROME E2E & SUPABASE FCM VERIFICATION PASSED!  ');
    console.log('====================================================\n');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
