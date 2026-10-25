const sharp = require('sharp');
const fs = require('fs');

async function createOgImage() {
  const width = 1200;
  const height = 630;

  const svgBanner = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090d16" />
          <stop offset="50%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e1b4b" />
        </linearGradient>
        <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="50%" stop-color="#818cf8" />
          <stop offset="100%" stop-color="#34d399" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      
      <!-- Text content -->
      <text x="480" y="270" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" fill="url(#textGrad)">GhumneChalo</text>
      <text x="480" y="335" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="700" fill="#f8fafc">Smart Travel &amp; Itinerary Platform</text>
      <text x="480" y="395" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="#94a3b8">AI Itineraries • Real-time Alerts • Offline Emergency • Local Discovery</text>
      
      <rect x="480" y="445" width="280" height="46" rx="23" fill="#2563eb" />
      <text x="620" y="475" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#ffffff" text-anchor="middle">ghumne-chalo.vercel.app</text>
    </svg>
  `;

  // Resize logo to 280x280
  const logoBuffer = await sharp('public/logo-transparent.png')
    .resize(280, 280, { fit: 'contain' })
    .toBuffer();

  const background = await sharp(Buffer.from(svgBanner)).png().toBuffer();

  await sharp(background)
    .composite([
      {
        input: logoBuffer,
        top: 175,
        left: 120,
      }
    ])
    .png()
    .toFile('public/og-image.png');

  console.log('Successfully created public/og-image.png (1200x630)');
}

createOgImage().catch(console.error);
