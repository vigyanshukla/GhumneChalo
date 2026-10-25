import puppeteer from 'puppeteer-core';
import fs from 'fs';

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
  await new Promise((r) => setTimeout(r, 3000));

  fs.writeFileSync('D:\\ghumnechalo\\scratch-page.html', await page.content());
  console.log('HTML_DUMPED_LENGTH:', (await page.content()).length);
  await browser.close();
}

main().catch(console.error);
