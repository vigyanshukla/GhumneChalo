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

  page.on('console', msg => console.log('PAGE CONSOLE:', msg.type(), msg.text()));
  page.on('response', async res => {
    if (res.url().includes('/budget')) {
      console.log('BUDGET RES:', res.status(), res.url());
      try {
        const text = await res.text();
        console.log('BUDGET RES BODY:', text);
      } catch {}
    }
  });

  // Login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.type("input[type='email']", 'traveler@ghumnechalo.com');
  await page.type("input[type='password']", 'Password123!');
  await page.click("button[type='submit']");
  await delay(2000);

  // Navigate to trip
  await page.goto(`${BASE_URL}/trips/cmups3ff100017k1wawgut0or`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Budget & Expenses'));
  });

  console.log('Clicking Budget & Expenses tab...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.textContent?.includes('Budget & Expenses'));
    if (b) b.click();
  });

  // Wait 4 seconds for fetch and render
  await delay(4000);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '20_budget_tab_active.png') });

  const finalHtml = await page.evaluate(() => {
    const budgetSection = document.querySelector('main');
    return budgetSection ? budgetSection.innerText : document.body.innerText;
  });
  console.log('FINAL SECTION TEXT:\n', finalHtml);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
