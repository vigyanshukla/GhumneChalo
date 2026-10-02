import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { savedPlaceCreateSchema, paginationSchema } from '@/lib/validation';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { evaluateAchievements } from '@/lib/achievements';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = request.nextUrl;

    const page = paginationSchema.shape.page.parse(searchParams.get('page') || undefined);
    const limit = paginationSchema.shape.limit.parse(searchParams.get('limit') || undefined);
    const category = searchParams.get('category');

    const where = {
      userId: user.id,
      ...(category ? { category } : {}),
    };

    const [total, savedPlaces] = await Promise.all([
      prisma.savedPlace.count({ where }),
      prisma.savedPlace.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { savedAt: 'desc' },
      }),
    ]);

    return apiSuccess(savedPlaces, 200, {
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const validatedData = savedPlaceCreateSchema.parse(body);

    const savedPlace = await prisma.savedPlace.create({
      data: {
        userId: user.id,
        placeId: validatedData.placeId,
        name: validatedData.name,
        address: validatedData.address,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        category: validatedData.category,
      },
    });

    try {
      await evaluateAchievements(user.id, { eventType: 'PLACE_SAVED' });
    } catch {
      // Non-blocking
    }

    return apiSuccess(savedPlace, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
