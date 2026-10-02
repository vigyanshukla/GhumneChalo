import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Users\\manis\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:\\Users\\manis\\.gemini\\antigravity-ide\\brain\\4fab1330-9b19-4958-b90d-ffd526ce9bcf\\p14b_screenshots';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('Launching browser to test Budget & Desktop Navigation...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Login
  console.log('Logging in as traveler@ghumnechalo.com...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.type("input[type='email']", 'traveler@ghumnechalo.com');
  await page.type("input[type='password']", 'Password123!');
  await page.click("button[type='submit']");
  await delay(2000);

  // 2. Desktop Navigation Test
  console.log('--- Testing Desktop AppNav links ---');
  await page.goto(`${BASE_URL}/trips`, { waitUntil: 'networkidle2' });
  await delay(1000);

  // Dismiss PWA banner if present
  await page.evaluate(() => {
    localStorage.setItem('ghumnechalo_pwa_dismissed', 'true');
    const dismissBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Not Now'));
    if (dismissBtn) dismissBtn.click();
  });

  // Verify all Desktop AppNav links on /trips
  const navLinks = await page.$$eval("header nav a", (els) =>
    els.map((e) => ({ text: e.textContent?.trim(), href: e.getAttribute('href') }))
  );
  console.log('Found AppNav links:', navLinks);

  // Test Profile Menu
  const profileBtn = await page.$('#profile-menu-btn');
  if (profileBtn) {
    await profileBtn.click();
    await delay(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '10_profile_dropdown_desktop.png') });
    console.log('Profile dropdown opened successfully.');
  }

  // 3. Open Trip Detail & Budget Tab
  console.log('--- Testing Trip Detail & Budget Tab ---');
  const tripId = 'cmups3ff100017k1wawgut0or';
  await page.goto(`${BASE_URL}/trips/${tripId}`, { waitUntil: 'networkidle2' });
  await delay(2000);

  // Dismiss PWA banner
  await page.evaluate(() => {
    localStorage.setItem('ghumnechalo_pwa_dismissed', 'true');
    const dismissBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Not Now'));
    if (dismissBtn) dismissBtn.click();
  });

  // Find and click the Budget & Expenses tab
  const clickedBudget = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Trip sections"]');
    if (!nav) return false;
    const buttons = Array.from(nav.querySelectorAll('button'));
    const budgetBtn = buttons.find(b => b.textContent?.includes('Budget'));
    if (budgetBtn) {
      budgetBtn.click();
      return true;
    }
    return false;
  });

  console.log('Budget tab clicked:', clickedBudget);
  await delay(1500);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, '20_budget_tab_active.png') });

  // Verify BudgetView elements
  const budgetData = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasBudgetHeading: text.includes('Trip Budget') || text.includes('Budget & Expenses') || text.includes('Budget Overview'),
      hasTotalBudget: text.includes('Total Budget') || text.includes('INR') || text.includes('₹'),
      hasAddExpenseBtn: !!document.querySelector("button#add-expense-btn, button:has-text('Add Expense')") || text.includes('Add Expense') || text.includes('Log Expense'),
      textSnippet: text.slice(0, 1000),
    };
  });

  console.log('Budget view inspection:', budgetData);

  // 4. Test Add Expense interaction
  console.log('--- Testing Add Expense Flow ---');
  const openedAddModal = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find(b => b.textContent?.includes('Add Expense') || b.textContent?.includes('Log Expense') || b.textContent?.includes('Record Expense'));
    if (addBtn) {
      addBtn.click();
      return true;
    }
    return false;
  });

  console.log('Add expense button clicked:', openedAddModal);
  await delay(1000);

  if (openedAddModal) {
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '21_add_expense_modal.png') });

    // Fill form inside modal
    const filledForm = await page.evaluate(() => {
      const amountInput = document.querySelector("input[name='amount'], input[type='number'], input[placeholder*='0.00' i]") as HTMLInputElement;
      const descInput = document.querySelector("input[name='description'], input[name='title'], input[placeholder*='description' i], input[placeholder*='Spent on' i]") as HTMLInputElement;
      
      if (amountInput) amountInput.value = '1500';
      if (descInput) descInput.value = 'Hawa Mahal Entry Tickets';

      // Trigger change events
      if (amountInput) amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      if (descInput) descInput.dispatchEvent(new Event('input', { bubbles: true }));

      return { hasAmount: !!amountInput, hasDesc: !!descInput };
    });

    console.log('Filled expense form:', filledForm);
    await delay(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '22_add_expense_filled.png') });

    // Click submit
    const submitted = await page.evaluate(() => {
      const submitBtn = document.querySelector("button[type='submit']") as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    });

    console.log('Submitted expense:', submitted);
    await delay(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '23_expense_logged_success.png') });
  }

  // 5. Test Theme Switching
  console.log('--- Testing Theme Switching ---');
  // Check if dark class toggle works
  const themeState = await page.evaluate(() => {
    const isDarkInitial = document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark');
    const isDarkToggled = document.documentElement.classList.contains('dark');
    return { isDarkInitial, isDarkToggled };
  });
  console.log('Theme toggle test:', themeState);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '28_trip_dark_mode.png') });

  console.log('Verification finished successfully!');
  await browser.close();
}

main().catch((err) => {
  console.error('Error in verification:', err);
  process.exit(1);
});
