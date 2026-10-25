import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import {
  getEmergencyContactsByCategory,
  OfflineEmergencyContact,
} from '@/lib/emergency';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category') as OfflineEmergencyContact['category'] | null;

    const contacts = getEmergencyContactsByCategory(category || undefined);

    return apiSuccess(
      {
        total: contacts.length,
        contacts,
        nationalPriorityHelpline: '112',
        updatedAt: '2026-09-28',
      },
      200,
      undefined,
      {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
