import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { searchHistoryCreateSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = request.nextUrl;
    const limit = Math.min(Number(searchParams.get('limit')) || 10, 50);

    const recent = await prisma.searchHistory.findMany({
      where: { userId: user.id },
      orderBy: { searchedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        query: true,
        placeId: true,
        placeName: true,
        latitude: true,
        longitude: true,
        searchCount: true,
        searchedAt: true,
      },
    });

    return apiSuccess(recent);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = searchHistoryCreateSchema.parse(body);

    // Upsert or increment count + update timestamp for deduplication
    const entry = await prisma.searchHistory.upsert({
      where: {
        userId_query: {
          userId: user.id,
          query: validatedData.query,
        },
      },
      create: {
        userId: user.id,
        query: validatedData.query,
        placeId: validatedData.placeId,
        placeName: validatedData.placeName,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        searchCount: 1,
        searchedAt: new Date(),
      },
      update: {
        placeId: validatedData.placeId ?? undefined,
        placeName: validatedData.placeName ?? undefined,
        latitude: validatedData.latitude ?? undefined,
        longitude: validatedData.longitude ?? undefined,
        searchCount: { increment: 1 },
        searchedAt: new Date(),
      },
    });

    return apiSuccess(entry, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
