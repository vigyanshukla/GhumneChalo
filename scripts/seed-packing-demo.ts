import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@ghumnechalo.com';
  const passwordHash = bcrypt.hashSync('Password123!', 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      emailVerified: new Date(),
      twoFactorEnabled: false,
    },
    create: {
      email,
      name: 'Priya Traveler',
      passwordHash,
      emailVerified: new Date(),
      twoFactorEnabled: false,
    },
  });

  console.log('Seeded demo user:', user.email, 'ID:', user.id);

  // Clear previous demo trips
  await prisma.packingItem.deleteMany({
    where: { trip: { userId: user.id } },
  });
  await prisma.trip.deleteMany({
    where: { userId: user.id, title: 'Manali Autumn Expedition' },
  });

  const trip = await prisma.trip.create({
    data: {
      userId: user.id,
      title: 'Manali Autumn Expedition',
      destinationName: 'Manali, Himachal Pradesh',
      latitude: 32.2432,
      longitude: 77.1892,
      startDate: new Date('2026-09-30T00:00:00Z'),
      endDate: new Date('2026-10-04T00:00:00Z'),
      status: 'UPCOMING',
    },
  });

  console.log('Seeded demo trip:', trip.title, 'Trip ID:', trip.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
