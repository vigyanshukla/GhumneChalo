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

  // Login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.type("input[type='email']", 'traveler@ghumnechalo.com');
  await page.type("input[type='password']", 'Password123!');
  await page.click("button[type='submit']");
  await delay(2000);

  // Navigate directly to target trip
  const tripUrl = `${BASE_URL}/trips/cmups3ff100017k1wawgut0or`;
  await page.goto(tripUrl, { waitUntil: 'networkidle2' });

  // Dismiss PWA
  await page.evaluate(() => {
    localStorage.setItem('ghumnechalo_pwa_dismissed', 'true');
    const dismiss = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Not Now'));
    if (dismiss) dismiss.click();
  });

  // Click Budget & Expenses
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Budget & Expenses'));
  });

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.textContent?.includes('Budget & Expenses'));
    if (b) b.click();
  });

  // Wait for Budget content
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Budget Overview');
  });

  // Click Add Expense
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find(b => b.textContent?.includes('Add Expense'));
    if (addBtn) addBtn.click();
  });
  await delay(800);

  // Type into form
  await page.type("input[placeholder*='e.g.' i]", 'Amber Fort Jeep Ride');
  await page.type("input[type='number']", '1200');
  await delay(500);

  // Click Save Expense directly
  console.log('Clicking Save Expense...');
  await page.click("button[type='submit']");

  // Wait for "Saving..." to finish and either "Expense added!" alert or the item to appear in the expense list
  console.log('Waiting for expense submission to complete...');
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes('Amber Fort') || text.includes('Expense added') || (text.includes('Spent') && !text.includes('Saving…'));
  }, { timeout: 20000 });

  await delay(1500);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '23_expense_logged_success.png') });

  // Read the updated page state
  const logInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasItem: text.includes('Amber Fort Jeep Ride') || text.includes('Jaipur Palace Audio Guide'),
      bodySnippet: text.slice(text.indexOf('Budget Overview'), text.indexOf('Budget Overview') + 600),
    };
  });
  console.log('Result after save expense:', logInfo);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
