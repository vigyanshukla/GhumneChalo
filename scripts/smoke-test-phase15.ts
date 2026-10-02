import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

async function runGoLiveSmokeTest() {
  console.log('=== STARTING PHASE 15 PRODUCTION GO-LIVE SMOKE TEST ===');

  const chromePath = 'C:\\Users\\manis\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome binary not found at: ${chromePath}`);
  }

  // 1. Create a verified test traveler in PostgreSQL
  const testEmail = `smoke-traveler-${Date.now()}@ghumnechalo.test`;
  const passwordHash = await bcrypt.hash('SmokePass123!', 10);
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: 'Go-Live Traveler',
      passwordHash,
      emailVerified: new Date(),
      notificationPreference: {
        create: {
          tripReminders: true,
          itineraryReminders: true,
          pushEnabled: true,
        },
      },
    },
  });

  // Generate a properly signed JWT that the middleware can verify
  const SECRET_KEY = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET || 'ghumnechalo-development-secret-key-change-in-production-min-32-chars'
  );
  const sessionToken = await new SignJWT({ userId: user.id, email: testEmail, name: 'Go-Live Traveler' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(SECRET_KEY);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Set the canonical auth_session cookie with the signed JWT
  await page.setCookie({
    name: 'auth_session',
    value: sessionToken,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
  });

  try {
    // Step 1: Landing Page
    console.log('[1/8] Loading Landing Page (/) ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    const landingHeading = await page.$eval('h1', (el) => el.textContent);
    console.log('Landing Heading:', landingHeading?.trim());

    // Step 2: Trips Dashboard
    console.log('[2/8] Loading Trips Dashboard (/trips) ...');
    await page.goto('http://localhost:3000/trips', { waitUntil: 'networkidle0' });
    const tripsText = await page.$eval('body', (el) => el.textContent);
    if (!tripsText.includes('Trips') && !tripsText.includes('traveler')) {
      throw new Error('Trips dashboard failed to render user context');
    }

    // Step 3: Explore Page & Destination Search
    console.log('[3/8] Loading Explore Destinations (/explore) ...');
    await page.goto('http://localhost:3000/explore', { waitUntil: 'networkidle0' });
    const exploreHeading = await page.$eval('h1, h2', (el) => el.textContent);
    console.log('Explore Page Heading:', exploreHeading?.trim());

    // Step 4: Emergency Page
    console.log('[4/8] Loading Emergency Mode (/emergency) ...');
    await page.goto('http://localhost:3000/emergency', { waitUntil: 'networkidle0' });
    const sos112 = await page.$('[data-testid="header-call-112"]');
    if (!sos112) throw new Error('Emergency SOS trigger missing');
    console.log('Emergency Mode verified');

    // Step 5: Reminders Page
    console.log('[5/8] Loading Reminders Manager (/reminders) ...');
    await page.goto('http://localhost:3000/reminders', { waitUntil: 'networkidle0' });
    const remindersText = await page.$eval('body', (el) => el.textContent);
    if (!remindersText.includes('Reminder')) throw new Error('Reminders view failed to load');
    console.log('Reminders Manager verified');

    // Step 6: Achievements Page
    console.log('[6/8] Loading Achievements (/achievements) ...');
    await page.goto('http://localhost:3000/achievements', { waitUntil: 'networkidle0' });
    const achievementsText = await page.$eval('body', (el) => el.textContent);
    if (!achievementsText.includes('Achievement') && !achievementsText.includes('Wanderer')) {
      throw new Error('Achievements view failed to load');
    }
    console.log('Achievements verified');

    // Step 7: Offline Route Fallback
    console.log('[7/8] Loading Offline Route (/offline) ...');
    await page.goto('http://localhost:3000/offline', { waitUntil: 'networkidle0' });
    const offlineTitle = await page.$eval('h1', (el) => el.textContent);
    if (!offlineTitle?.includes('Offline')) throw new Error('Offline fallback route mismatch');
    console.log('Offline fallback route verified:', offlineTitle?.trim());

    // Step 8: PWA Manifest & Service Worker Script
    console.log('[8/8] Validating PWA Manifest & Service Worker ...');
    const manifestRes = await page.goto('http://localhost:3000/manifest.json');
    if (!manifestRes || manifestRes.status() !== 200) throw new Error('manifest.json returned non-200');
    const swRes = await page.goto('http://localhost:3000/sw.js');
    if (!swRes || swRes.status() !== 200) throw new Error('sw.js returned non-200');
    console.log('PWA Manifest & Service Worker verified');

    console.log('=== PHASE 15 PRODUCTION GO-LIVE SMOKE TEST PASSED ===');
  } finally {
    await browser.close();
    // Cleanup smoke test user
    await prisma.notificationPreference.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  }
}

runGoLiveSmokeTest().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
