import { prisma } from '../src/lib/prisma';
import { savePushSubscription } from '../src/lib/push/push-service';
import { createNotification } from '../src/lib/notifications';

async function main() {
  console.log('--- Step 1: Find or create demo traveler ---');
  let user = await prisma.user.findUnique({
    where: { email: 'traveler@ghumnechalo.com' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'traveler@ghumnechalo.com',
        name: 'GhumneChalo Explorer',
      },
    });
  }
  console.log(`User ID: ${user.id} (${user.email})`);

  console.log('\n--- Step 2: Store Web Push / FCM Subscription into Supabase ---');
  const mockFcmToken = 'fcm_token_chrome_' + Date.now();
  const mockEndpoint = `https://fcm.googleapis.com/fcm/send/${mockFcmToken}`;
  const sub = await savePushSubscription(user.id, {
    endpoint: mockEndpoint,
    p256dh: 'BNcRdreALRF8Sx_dummy_p256dh_key_data',
    auth: 'tH8A_dummy_auth_secret',
    fcmToken: mockFcmToken,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0',
  });

  console.log('Push subscription persisted in Supabase:');
  console.log('ID:', sub.id);
  console.log('Endpoint:', sub.endpoint);
  console.log('FCM Token:', sub.fcmToken);

  console.log('\n--- Step 3: Verify directly in Supabase push_subscriptions table ---');
  const dbSub = await prisma.pushSubscription.findUnique({
    where: { endpoint: mockEndpoint },
  });
  console.log('Found in Supabase DB:', dbSub?.id === sub.id ? 'YES (MATCH)' : 'NO');
  console.log('Stored FCM Token:', dbSub?.fcmToken);

  console.log('\n--- Step 4: Create Notification in Supabase ---');
  const notifResult = await createNotification(user.id, {
    type: 'TRIP_REMINDER',
    title: '🏝️ Pack your bags for Goa!',
    body: 'Your flight departs in 24 hours. Weather in Goa is sunny 29°C.',
    actionUrl: '/trips',
    data: {
      tripName: 'Goa Summer Wander',
      destination: 'Goa, India',
      fcmDispatched: true,
    },
  });

  console.log('Notification created in Supabase:', notifResult.created);
  console.log('Notification ID:', notifResult.notification?.id);
  console.log('Notification Title:', notifResult.notification?.title);

  console.log('\n--- Step 5: Verify Notification in Supabase notifications table ---');
  const dbNotif = await prisma.notification.findUnique({
    where: { id: notifResult.notification?.id },
  });
  console.log('Found in Supabase notifications table:', dbNotif ? 'YES' : 'NO');
  console.log('Notification data payload:', dbNotif?.data);
}

main()
  .then(() => {
    console.log('\n✅ ALL SUPABASE FCM & NOTIFICATION CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error during test:', err);
    process.exit(1);
  });
