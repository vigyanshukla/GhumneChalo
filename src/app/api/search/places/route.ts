import { GET as placesSearchHandler } from '../../places/search/route';

export const dynamic = 'force-dynamic';

export async function GET(request: Parameters<typeof placesSearchHandler>[0]) {
  return placesSearchHandler(request);
}
