import { apiSuccess } from '@/lib/api-response';

export async function GET() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    'BI_4kphhlncigntNcpkf_33-JK1PnhLHgS26YRFfi4n5Iwy89BvaZnklS7mHXDEbwqv-NqQd7OoruMyQMEfKU0M';

  return apiSuccess({ publicKey }, 200, undefined, {
    'Cache-Control': 'public, max-age=86400, immutable',
  });
}
