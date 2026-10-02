import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Users\\manis\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.type("input[type='email']", 'traveler@ghumnechalo.com');
  await page.type("input[type='password']", 'Password123!');
  await page.click("button[type='submit']");
  await new Promise((r) => setTimeout(r, 2000));

  await page.goto('http://localhost:3000/trips/cmups3ff100017k1wawgut0or', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2500));

  const text = await page.evaluate(() => document.body.innerText);
  console.log('HAS_GOLDEN_TRIANGLE:', text.includes('Golden Triangle Adventure'));
  console.log('HAS_OVERVIEW:', text.includes('Overview'));
  console.log('HAS_BUDGET_EXPENSES:', text.includes('Budget & Expenses'));

  // Click Budget & Expenses
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => x.textContent?.includes('Budget & Expenses'));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  const textAfterBudgetClick = await page.evaluate(() => document.body.innerText);
  console.log('BUDGET_METRICS_PRESENT:', textAfterBudgetClick.includes('Total Budget'));
  console.log('EXPENSE_LOG_PRESENT:', textAfterBudgetClick.includes('Expense Log'));
  console.log('ADD_EXPENSE_BTN_PRESENT:', textAfterBudgetClick.includes('Add Expense'));
  console.log('FUTURE_PHASES_PLACEHOLDER_PRESENT:', textAfterBudgetClick.includes('will be enabled in future phases'));

  await browser.close();
}

main().catch(console.error);
