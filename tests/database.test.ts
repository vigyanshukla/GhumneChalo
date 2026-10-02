import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';

describe('Phase 1 — Database Models & Constraints (TC-1.01 to TC-1.15)', () => {
  let testUserId: string;
  let testTripId: string;
  let testDayId: string;
  let testBudgetId: string;

  beforeAll(async () => {
    // Ensure clean state for test run
    await prisma.achievement.deleteMany({ where: { user: { email: { contains: '@test-db.com' } } } });
    await prisma.notification.deleteMany({ where: { user: { email: { contains: '@test-db.com' } } } });
    await prisma.savedPlace.deleteMany({ where: { user: { email: { contains: '@test-db.com' } } } });
    await prisma.searchHistory.deleteMany({ where: { user: { email: { contains: '@test-db.com' } } } });
    await prisma.trip.deleteMany({ where: { user: { email: { contains: '@test-db.com' } } } });
    await prisma.user.deleteMany({ where: { email: { contains: '@test-db.com' } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@test-db.com' } } });
    await prisma.$disconnect();
  });

  // TC-1.01: Database connection
  it('TC-1.01: Database connection succeeds using configured environment', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  // TC-1.02: Migration / Schema verification
  it('TC-1.02: All required database tables exist in PostgreSQL schema', async () => {
    const tableNames: Array<{ table_name: string }> = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const tables = tableNames.map((t) => t.table_name);
    expect(tables).toContain('users');
    expect(tables).toContain('trips');
    expect(tables).toContain('itinerary_days');
    expect(tables).toContain('itinerary_items');
    expect(tables).toContain('budgets');
    expect(tables).toContain('expenses');
    expect(tables).toContain('transportation');
    expect(tables).toContain('weather_snapshots');
    expect(tables).toContain('saved_places');
    expect(tables).toContain('search_history');
    expect(tables).toContain('notifications');
    expect(tables).toContain('achievements');
  });

  // TC-1.03: Create user
  it('TC-1.03: Create and persist user', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'traveler1@test-db.com',
        name: 'Traveler One',
      },
    });
    expect(user.id).toBeDefined();
    expect(user.email).toBe('traveler1@test-db.com');
    testUserId = user.id;
  });

  // TC-1.04: Create trip for user
  it('TC-1.04: Create trip associated with correct user', async () => {
    const trip = await prisma.trip.create({
      data: {
        userId: testUserId,
        title: 'Goa Weekend Getaway',
        destinationName: 'Goa, India',
        destinationPlaceId: 'ChIJwTa18659vzsR4jP_uUvH3bU',
        latitude: 15.2993,
        longitude: 74.124,
        startDate: new Date('2026-10-10'),
        endDate: new Date('2026-10-14'),
        totalBudget: 25000,
        currency: 'INR',
        status: 'UPCOMING',
      },
    });
    expect(trip.id).toBeDefined();
    expect(trip.userId).toBe(testUserId);
    testTripId = trip.id;
  });

  // TC-1.05: Create itinerary day
  it('TC-1.05: Create itinerary day associated with correct trip', async () => {
    const day = await prisma.itineraryDay.create({
      data: {
        tripId: testTripId,
        dayNumber: 1,
        date: new Date('2026-10-10'),
        title: 'Arrival & Beach Walk',
      },
    });
    expect(day.id).toBeDefined();
    expect(day.tripId).toBe(testTripId);
    expect(day.dayNumber).toBe(1);
    testDayId = day.id;
  });

  // TC-1.06: Create itinerary item
  it('TC-1.06: Create itinerary item associated with correct day', async () => {
    const item = await prisma.itineraryItem.create({
      data: {
        itineraryDayId: testDayId,
        name: 'Baga Beach Sunset',
        placeId: 'ChIJ5bKxN4-CvzsRFaQo_s20_rE',
        startTime: '17:00',
        endTime: '19:30',
        order: 0,
        notes: 'Watch sunset and explore shacks',
      },
    });
    expect(item.id).toBeDefined();
    expect(item.itineraryDayId).toBe(testDayId);
  });

  // TC-1.07: Create budget
  it('TC-1.07: Create budget associated with correct trip', async () => {
    const budget = await prisma.budget.create({
      data: {
        tripId: testTripId,
        totalAmount: 25000,
        currency: 'INR',
      },
    });
    expect(budget.id).toBeDefined();
    expect(budget.tripId).toBe(testTripId);
    testBudgetId = budget.id;
  });

  // TC-1.08: Create expense
  it('TC-1.08: Create expense associated with correct budget', async () => {
    const expense = await prisma.expense.create({
      data: {
        budgetId: testBudgetId,
        category: 'FOOD',
        description: 'Beach Shack Dinner',
        amount: 1850,
      },
    });
    expect(expense.id).toBeDefined();
    expect(expense.budgetId).toBe(testBudgetId);
    expect(expense.amount).toBe(1850);
  });

  // TC-1.09: Create transportation
  it('TC-1.09: Create transportation associated with correct trip', async () => {
    const transit = await prisma.transportation.create({
      data: {
        tripId: testTripId,
        type: 'FLIGHT',
        origin: 'Mumbai (BOM)',
        destination: 'Goa (GOI)',
        departureTime: new Date('2026-10-10T08:00:00Z'),
        arrivalTime: new Date('2026-10-10T09:15:00Z'),
        cost: 4500,
        currency: 'INR',
      },
    });
    expect(transit.id).toBeDefined();
    expect(transit.tripId).toBe(testTripId);
  });

  // TC-1.10: Create saved place
  it('TC-1.10: Create saved place associated with correct user', async () => {
    const saved = await prisma.savedPlace.create({
      data: {
        userId: testUserId,
        placeId: 'ChIJ5bKxN4-CvzsRFaQo_s20_rE',
        name: 'Baga Beach',
        category: 'Beach',
        latitude: 15.5553,
        longitude: 73.7517,
      },
    });
    expect(saved.id).toBeDefined();
    expect(saved.userId).toBe(testUserId);
  });

  // TC-1.11: Duplicate saved place
  it('TC-1.11: Duplicate saved place is prevented by unique constraint', async () => {
    await expect(
      prisma.savedPlace.create({
        data: {
          userId: testUserId,
          placeId: 'ChIJ5bKxN4-CvzsRFaQo_s20_rE', // Duplicate
          name: 'Baga Beach Again',
        },
      })
    ).rejects.toThrow();
  });

  // TC-1.12: Create search history
  it('TC-1.12: Create search history associated with correct user', async () => {
    const search = await prisma.searchHistory.create({
      data: {
        userId: testUserId,
        query: 'Goa beaches',
        placeName: 'Goa',
        searchCount: 1,
      },
    });
    expect(search.id).toBeDefined();
    expect(search.userId).toBe(testUserId);
  });

  // TC-1.13: Create notification
  it('TC-1.13: Create notification associated with correct user', async () => {
    const notif = await prisma.notification.create({
      data: {
        userId: testUserId,
        type: 'TRIP_REMINDER',
        title: 'Trip Starting Soon',
        body: 'Your Goa trip starts in 2 weeks!',
      },
    });
    expect(notif.id).toBeDefined();
    expect(notif.userId).toBe(testUserId);
  });

  // TC-1.14: Create achievement
  it('TC-1.14: Create achievement associated with correct user', async () => {
    const achievement = await prisma.achievement.create({
      data: {
        userId: testUserId,
        type: 'FIRST_TRIP',
        progress: 100,
      },
    });
    expect(achievement.id).toBeDefined();
    expect(achievement.userId).toBe(testUserId);
  });

  // TC-1.15: Duplicate achievement
  it('TC-1.15: Duplicate achievement unlock is prevented by unique constraint', async () => {
    await expect(
      prisma.achievement.create({
        data: {
          userId: testUserId,
          type: 'FIRST_TRIP', // Duplicate
          progress: 100,
        },
      })
    ).rejects.toThrow();
  });
});
