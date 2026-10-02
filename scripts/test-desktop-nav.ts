import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Users\\manis\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:\\Users\\manis\\.gemini\\antigravity-ide\\brain\\4fab1330-9b19-4958-b90d-ffd526ce9bcf\\p14b_screenshots';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.type("input[type='email']", 'traveler@ghumnechalo.com');
  await page.type("input[type='password']", 'Password123!');
  await page.click("button[type='submit']");
  await delay(2000);

  const testRoutes = [
    { name: 'Trips', href: '/trips', selector: "h1, main" },
    { name: 'Explore', href: '/explore', selector: "h1, input" },
    { name: 'Reminders', href: '/reminders', selector: "h1, h2" },
    { name: 'Badges', href: '/achievements', selector: "h1, h2" },
    { name: 'Emergency', href: '/emergency', selector: "h1, h2" },
  ];

  for (const route of testRoutes) {
    console.log(`Navigating to ${route.name} (${route.href})...`);
    await page.goto(`${BASE_URL}${route.href}`, { waitUntil: 'networkidle2' });
    await delay(1000);
    const title = await page.title();
    const h1 = await page.$eval('h1', el => el.textContent?.trim()).catch(() => 'No H1');
    console.log(`  -> Title: "${title}", H1: "${h1}"`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `nav_${route.name.toLowerCase()}.png`) });
  }

  // Test profile dropdown on /trips
  console.log('Testing Profile Dropdown on /trips...');
  await page.goto(`${BASE_URL}/trips`, { waitUntil: 'networkidle2' });
  await delay(1000);
  await page.click('#profile-menu-btn');
  await delay(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'nav_profile_menu.png') });

  // Click Settings & Security in dropdown
  await page.click("a[href='/settings/security']");
  await delay(1200);
  const securityH1 = await page.$eval('h1, h2', el => el.textContent?.trim()).catch(() => '');
  console.log(`  -> Security page header: "${securityH1}"`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'nav_security_page.png') });

  console.log('Desktop navigation verification complete!');
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
