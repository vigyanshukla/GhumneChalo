import { prisma } from '../src/lib/prisma';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'traveler@ghumnechalo.com' } });
  if (!user) throw new Error('User not found');
  const trip = await prisma.trip.create({
    data: {
      userId: user.id,
      title: 'Golden Triangle Adventure',
      destinationName: 'Delhi & Jaipur, India',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-07'),
      status: 'UPCOMING',
      budget: {
        create: {
          totalAmount: 50000,
          currency: 'INR',
        },
      },
    },
  });
  console.log('TRIP_CREATED_SUCCESS:', trip.id);
}

main().catch(console.error);
