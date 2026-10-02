import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { GET as getTrips, POST as createTrip } from '../src/app/api/trips/route';
import { GET as getTrip, PATCH as patchTrip, DELETE as deleteTrip } from '../src/app/api/trips/[tripId]/route';
import { POST as addExpense } from '../src/app/api/trips/[tripId]/expenses/route';
import { handleApiError } from '../src/lib/api-error';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

describe('Phase 1 — API Lifecycle, Validation & Errors (TC-1.16 to TC-1.21, TC-1.33 to TC-1.44)', () => {
  let user: { id: string; email: string };
  let tripId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: 'api-tester@ghumnechalo.com' },
    });

    user = await prisma.user.create({
      data: { email: 'api-tester@ghumnechalo.com', name: 'API Tester' },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: 'api-tester@ghumnechalo.com' },
    });
  });

  function req(url: string, method = 'GET', authUserId?: string, body?: unknown) {
    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers: {
        'content-type': 'application/json',
        ...(authUserId ? { authorization: `Bearer ${authUserId}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  // TC-1.16: GET trips while unauthenticated -> 401
  it('TC-1.16: GET trips while unauthenticated -> 401', async () => {
    const r = req('/api/trips', 'GET');
    const res = await getTrips(r);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  // TC-1.17: POST trip while unauthenticated -> 401
  it('TC-1.17: POST trip while unauthenticated -> 401', async () => {
    const r = req('/api/trips', 'POST', undefined, {
      title: 'Kerala Backwaters',
      destinationName: 'Alleppey, Kerala',
      startDate: '2026-11-10',
      endDate: '2026-11-15',
    });
    const res = await createTrip(r);
    expect(res.status).toBe(401);
  });

  // TC-1.18: Create trip while authenticated -> 201 and belongs to current user
  it('TC-1.18: Create trip while authenticated -> 201', async () => {
    const r = req('/api/trips', 'POST', user.id, {
      title: 'Kerala Backwaters Tour',
      destinationName: 'Alleppey, Kerala',
      startDate: '2026-11-10',
      endDate: '2026-11-15',
      totalBudget: 35000,
      currency: 'INR',
      status: 'UPCOMING',
    });
    const res = await createTrip(r);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.userId).toBe(user.id);
    tripId = data.data.id;
  });

  // TC-1.19: Get own trip -> 200
  it('TC-1.19: Get own trip -> 200', async () => {
    const r = req(`/api/trips/${tripId}`, 'GET', user.id);
    const res = await getTrip(r, { params: Promise.resolve({ tripId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(tripId);
  });

  // TC-1.20: Modify own trip -> 200
  it('TC-1.20: Modify own trip -> successful update', async () => {
    const r = req(`/api/trips/${tripId}`, 'PATCH', user.id, {
      title: 'Kerala Backwaters Luxury Tour',
      totalBudget: 45000,
    });
    const res = await patchTrip(r, { params: Promise.resolve({ tripId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.title).toBe('Kerala Backwaters Luxury Tour');
    expect(data.data.totalBudget).toBe(45000);
  });

  // TC-1.33: Malformed trip ID -> 400/422 validation failure
  it('TC-1.33: Malformed trip ID -> 422 validation failure', async () => {
    const malformedId = 'short'; // Fails minimum length of 10
    const r = req(`/api/trips/${malformedId}`, 'GET', user.id);
    const res = await getTrip(r, { params: Promise.resolve({ tripId: malformedId }) });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  // TC-1.34: Invalid date -> validation failure
  it('TC-1.34: Invalid date format -> 422 validation failure', async () => {
    const r = req('/api/trips', 'POST', user.id, {
      title: 'Invalid Date Trip',
      destinationName: 'Delhi',
      startDate: 'not-a-valid-date',
      endDate: '2026-11-15',
    });
    const res = await createTrip(r);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-1.35: End date before start date -> Validation failure
  it('TC-1.35: End date before start date -> 422 validation failure', async () => {
    const r = req('/api/trips', 'POST', user.id, {
      title: 'Impossible Dates Trip',
      destinationName: 'Agra',
      startDate: '2026-11-20',
      endDate: '2026-11-10', // Before start date!
    });
    const res = await createTrip(r);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-1.36: Negative budget -> Validation failure
  it('TC-1.36: Negative total budget -> 422 validation failure', async () => {
    const r = req('/api/trips', 'POST', user.id, {
      title: 'Negative Budget Trip',
      destinationName: 'Jaipur',
      startDate: '2026-11-01',
      endDate: '2026-11-05',
      totalBudget: -5000,
    });
    const res = await createTrip(r);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-1.37: Negative expense -> Validation failure
  it('TC-1.37: Negative expense amount -> 422 validation failure', async () => {
    const r = req(`/api/trips/${tripId}/expenses`, 'POST', user.id, {
      category: 'FOOD',
      description: 'Refund trick',
      amount: -100, // Negative amount
    });
    const res = await addExpense(r, { params: Promise.resolve({ tripId }) });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // TC-1.38: Invalid coordinates -> Validation failure
  it('TC-1.38: Invalid coordinates (latitude > 90) -> 422 validation failure', async () => {
    const r = req('/api/trips', 'POST', user.id, {
      title: 'Orbit Trip',
      destinationName: 'Space',
      latitude: 195.5, // Impossible latitude
      longitude: 72.8,
      startDate: '2026-11-01',
      endDate: '2026-11-05',
    });
    const res = await createTrip(r);
    expect(res.status).toBe(422);
  });

  // TC-1.39: Oversized text input -> Validation failure
  it('TC-1.39: Oversized title (>100 chars) -> 422 validation failure', async () => {
    const r = req('/api/trips', 'POST', user.id, {
      title: 'A'.repeat(150),
      destinationName: 'Varanasi',
      startDate: '2026-11-01',
      endDate: '2026-11-05',
    });
    const res = await createTrip(r);
    expect(res.status).toBe(422);
  });

  // TC-1.40: Invalid enum -> Validation failure
  it('TC-1.40: Invalid trip status enum -> 422 validation failure', async () => {
    const r = req('/api/trips', 'POST', user.id, {
      title: 'Invalid Enum Trip',
      destinationName: 'Pune',
      startDate: '2026-11-01',
      endDate: '2026-11-05',
      status: 'NON_EXISTENT_STATUS',
    });
    const res = await createTrip(r);
    expect(res.status).toBe(422);
  });

  // TC-1.41: Database temporarily unavailable -> Safe 500 response, no secret leak
  it('TC-1.41: Database initialization error yields safe 500 without leaking connection credentials', async () => {
    const simulatedInitError = new Prisma.PrismaClientInitializationError(
      'Can not reach database server at postgresql://user:secretpassword@db.supabase.co:5432/postgres',
      '6.19.3'
    );
    const response = handleApiError(simulatedInitError);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toBe('Database service is temporarily unavailable');
    // Ensure credentials and internal URL are NEVER leaked in user-facing message
    expect(data.error.message).not.toContain('secretpassword');
    expect(data.error.message).not.toContain('postgresql://');
  });

  // TC-1.42: Unexpected server exception -> Safe 500 response
  it('TC-1.42: Unexpected server exception -> Safe 500 response', async () => {
    const unexpectedError = new Error('Unexpected OS pointer fault at /sys/kernel/io');
    const response = handleApiError(unexpectedError);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(data.error.message).toBe('An unexpected server error occurred');
  });

  // TC-1.43: Nonexistent trip -> 404
  it('TC-1.43: Nonexistent trip -> 404 Not Found', async () => {
    const nonExistentId = 'cm8999999999999999999999';
    const r = req(`/api/trips/${nonExistentId}`, 'GET', user.id);
    const res = await getTrip(r, { params: Promise.resolve({ tripId: nonExistentId }) });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  // TC-1.21: Delete own trip -> successful deletion
  it('TC-1.21: Delete own trip -> successful deletion', async () => {
    const r = req(`/api/trips/${tripId}`, 'DELETE', user.id);
    const res = await deleteTrip(r, { params: Promise.resolve({ tripId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  // TC-1.44: Already deleted resource -> 404 Not Found on subsequent fetch
  it('TC-1.44: Already deleted resource returns 404', async () => {
    const r = req(`/api/trips/${tripId}`, 'GET', user.id);
    const res = await getTrip(r, { params: Promise.resolve({ tripId }) });
    expect(res.status).toBe(404);
  });
});
