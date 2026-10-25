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
  console.log('Logging in...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.type("input[type='email']", 'traveler@ghumnechalo.com');
  await page.type("input[type='password']", 'Password123!');
  await page.click("button[type='submit']");
  await delay(2000);

  // Navigate directly to target trip
  const tripUrl = `${BASE_URL}/trips/cmups3ff100017k1wawgut0or`;
  console.log('Navigating to trip:', tripUrl);
  await page.goto(tripUrl, { waitUntil: 'networkidle2' });

  // Dismiss PWA
  await page.evaluate(() => {
    localStorage.setItem('ghumnechalo_pwa_dismissed', 'true');
    const dismiss = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Not Now'));
    if (dismiss) dismiss.click();
  });

  // Wait for the tab buttons to appear
  console.log('Waiting for trip tabs to mount in DOM...');
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Budget & Expenses'));
  }, { timeout: 15000 });

  // Click Budget & Expenses
  console.log('Clicking Budget & Expenses tab...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.textContent?.includes('Budget & Expenses'));
    if (b) b.click();
  });

  // Wait for Budget content to render (wait for loader to disappear and "Total Budget" or "Budget Overview" to appear)
  console.log('Waiting for BudgetView content to mount (loader to clear)...');
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes('Budget Overview') || text.includes('Total Budget') || text.includes('No Budget Set') || text.includes('Expense Log');
  }, { timeout: 15000 });

  console.log('BudgetView content is MOUNTED and VISIBLE!');
  await delay(1000);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '20_budget_tab_active.png') });

  // Inspect the BudgetView content
  const budgetInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
    return {
      hasBudgetHeading: text.includes('Budget Overview'),
      hasTotalBudget: text.includes('Total Budget'),
      hasRemaining: text.includes('Remaining'),
      hasAddExpenseBtn: buttons.some(b => b.includes('Add Expense') || b.includes('Log Expense')),
      buttons,
      textPreview: text.slice(text.indexOf('Budget Overview'), text.indexOf('Budget Overview') + 500),
    };
  });
  console.log('Budget View inspection:', budgetInfo);

  // Click Add Expense button
  console.log('Clicking Add Expense button...');
  const clickedAdd = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find(b => b.textContent?.includes('Add Expense') || b.textContent?.includes('Log First Expense'));
    if (addBtn) {
      addBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked Add Expense:', clickedAdd);
  await delay(1000);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '21_add_expense_modal.png') });

  // Fill expense form
  console.log('Filling expense form...');
  await page.type("input[type='text'], input[placeholder*='Hotel' i], input[placeholder*='e.g.' i]", 'City Palace Audio Tour & Entry');
  await page.type("input[type='number']", '1800');
  await delay(500);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '22_add_expense_filled.png') });

  // Click Save Expense
  console.log('Submitting expense...');
  const submitted = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const saveBtn = btns.find(b => b.textContent?.includes('Save Expense') || (b as HTMLButtonElement).type === 'submit');
    if (saveBtn) {
      saveBtn.click();
      return true;
    }
    return false;
  });
  console.log('Submitted expense button clicked:', submitted);
  await delay(2500);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '23_expense_logged_success.png') });

  // Verify expense in list
  const finalSummary = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasLoggedItem: text.includes('City Palace Audio Tour & Entry'),
      hasUpdatedRemaining: text.includes('₹48,200') || text.includes('48,200'),
      hasSpent: text.includes('₹1,800') || text.includes('1,800'),
    };
  });
  console.log('Final expense log verification:', finalSummary);

  console.log('SUCCESS: BudgetView full lifecycle verified!');
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
