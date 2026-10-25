const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

const vapidBlock = `
# Web Push / FCM (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BI_4kphhlncigntNcpkf_33-JK1PnhLHgS26YRFfi4n5Iwy89BvaZnklS7mHXDEbwqv-NqQd7OoruMyQMEfKU0M"
VAPID_PRIVATE_KEY="nIgi6w8vckPqXd31SRKokjzhqAn6UO48SP8tODHpNv4"
VAPID_SUBJECT="mailto:support@ghumnechalo.com"
`;

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  if (!content.includes('VAPID_PUBLIC_KEY')) {
    fs.appendFileSync(envPath, vapidBlock);
    console.log('Appended VAPID keys to .env');
  }
}

if (fs.existsSync(envExamplePath)) {
  const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
  if (!exampleContent.includes('VAPID_PUBLIC_KEY')) {
    const exampleBlock = `
# Web Push / FCM (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:support@ghumnechalo.com"
`;
    fs.appendFileSync(envExamplePath, exampleBlock);
    console.log('Appended VAPID keys to .env.example');
  }
}
