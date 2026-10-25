import { prisma } from '../src/lib/prisma';
import { sendPushToUser } from '../src/lib/push/push-service';
import { createNotification } from '../src/lib/notifications';
import webpush from 'web-push';
import * as dotenv from 'dotenv';

dotenv.config();

// Ensure VAPID is configured
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@ghumnechalo.com';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('✅ WebPush VAPID configured successfully');
  } catch (err) {
    console.error('❌ Failed to configure VAPID:', err);
  }
} else {
  console.warn('⚠️ VAPID keys missing in env:', { hasPublic: !!vapidPublicKey, hasPrivate: !!vapidPrivateKey });
}

async function main() {
  console.log('🔍 Searching for souldew / manish users in database...');
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'souldew', mode: 'insensitive' } },
        { name: { contains: 'souldew', mode: 'insensitive' } },
        { name: { contains: 'manish', mode: 'insensitive' } },
      ],
    },
    include: {
      pushSubscriptions: true,
      notificationPreference: true,
    },
  });

  console.log(`Found ${users.length} matching users:`);
  for (const u of users) {
    console.log(`- User: ${u.name} (${u.email}) [ID: ${u.id}]`);
    console.log(`  Push Subscriptions: ${u.pushSubscriptions.length}`);
    console.log(`  Notification Preferences:`, u.notificationPreference);
  }

  // Also query all push subscriptions in the system to see if there are any others
  const allSubscriptions = await prisma.pushSubscription.findMany({
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
  console.log(`\nTotal push subscriptions across ALL users in database: ${allSubscriptions.length}`);
  for (const sub of allSubscriptions) {
    console.log(`- Sub ID: ${sub.id}, User: ${sub.user.name} (${sub.user.email})`);
    console.log(`  Endpoint: ${sub.endpoint.slice(0, 60)}...`);
    console.log(`  UserAgent: ${sub.userAgent}`);
    console.log(`  Created: ${sub.createdAt}`);
  }

  // Target users: all found souldew users OR any user whose subscriptions look like souldew
  const targetUsers = users.length > 0 ? users : allSubscriptions.map(s => s.user);

  if (targetUsers.length === 0) {
    console.log('❌ No matching users or subscriptions found.');
    return;
  }

  const notificationPayload = {
    title: '🚀 GhumneChalo Alert!',
    body: 'Namaste Manish! Web push notification test successful on your registered device.',
    actionUrl: '/home',
    data: {
      timestamp: Date.now(),
      sender: 'GhumneChalo System',
      message: 'Web push notification to souldew devices',
    },
  };

  for (const user of targetUsers) {
    console.log(`\n========================================`);
    console.log(`📤 Sending push to User: ${user.name} (${user.email})...`);

    // Ensure pushEnabled is true in preferences so sendPushToUser does not block it
    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: { pushEnabled: true },
      create: { userId: user.id, pushEnabled: true },
    });

    // 1. Create In-App Notification in DB
    const notifResult = await createNotification(user.id, {
      type: 'SYSTEM',
      title: notificationPayload.title,
      body: notificationPayload.body,
      actionUrl: notificationPayload.actionUrl,
      data: notificationPayload.data,
    });
    console.log(`📝 In-app notification created:`, notifResult.notification?.id);

    // 2. Dispatch push via sendPushToUser
    const pushResult = await sendPushToUser(user.id, notificationPayload);
    console.log(`📡 Dispatch result:`, pushResult);

    // 3. For any direct subscription, test direct webpush sendNotification with detailed logging
    const userSubs = await prisma.pushSubscription.findMany({
      where: { userId: user.id },
    });

    for (const sub of userSubs) {
      console.log(`\n  👉 Testing subscription: ${sub.endpoint.slice(0, 60)}...`);
      try {
        const res = await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify({
            title: notificationPayload.title,
            body: notificationPayload.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            actionUrl: notificationPayload.actionUrl,
            data: notificationPayload.data,
          })
        );
        console.log(`  ✅ Push delivered! Status code: ${res.statusCode}`);
      } catch (err: any) {
        console.error(`  ❌ WebPush delivery error:`, {
          statusCode: err.statusCode,
          message: err.message,
          body: err.body,
        });
      }
    }
  }

  // Also dispatch to all subscriptions found in DB in case device was registered earlier
  console.log(`\n========================================`);
  console.log(`📡 Broadcasting push notification to all ${allSubscriptions.length} registered device endpoints in database...`);
  for (const sub of allSubscriptions) {
    console.log(`\n👉 Sending to subscription: ${sub.id} (User: ${sub.user.email})`);
    console.log(`   Endpoint: ${sub.endpoint.slice(0, 60)}...`);
    try {
      const res = await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify({
          title: '🏝️ GhumneChalo: Test Notification!',
          body: 'Namaste Manish! Web push notification test successful on your registered device.',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          actionUrl: '/home',
          data: {
            timestamp: Date.now(),
            target: 'souldew',
          },
        })
      );
      console.log(`   ✅ Direct WebPush delivered successfully! (Status: ${res.statusCode})`);
    } catch (err: any) {
      console.error(`   ❌ WebPush delivery failed:`, {
        statusCode: err.statusCode,
        message: err.message,
        body: err.body,
      });
    }
  }
}

main()
  .catch((e) => {
    console.error('Fatal error in script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
