export interface NormalizedPlace {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
}

export interface NormalizedPlaceDetails extends NormalizedPlace {
  nationalPhoneNumber?: string;
  websiteUri?: string;
  openNow?: boolean;
  weekdayDescriptions?: string[];
}

export interface SearchHistoryItem {
  id?: string;
  query: string;
  placeId?: string | null;
  placeName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  searchCount?: number;
  searchedAt?: string | Date;
}
