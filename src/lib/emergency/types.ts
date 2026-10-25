export const EMERGENCY_CATEGORIES = ['police', 'hospital', 'pharmacy'] as const;
export type EmergencyCategory = (typeof EMERGENCY_CATEGORIES)[number];

export interface EmergencyPlace {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  category: EmergencyCategory;
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  distanceKm: number;
  distanceFormatted: string;
  phoneNumber?: string | null;
  openNow?: boolean | null;
  directionsUrl: string;
}

export interface OfflineEmergencyContact {
  id: string;
  name: string;
  number: string;
  category: 'national' | 'police' | 'medical' | 'women' | 'tourist' | 'transport' | 'disaster';
  description: string;
  availableHours: string;
  isTollFree: boolean;
  priority: number;
}

export interface EmergencySearchResponse {
  category: EmergencyCategory;
  userLocation: {
    latitude: number;
    longitude: number;
  };
  places: EmergencyPlace[];
  isOfflineFallback: boolean;
  offlineHelplines: OfflineEmergencyContact[];
  meta: {
    totalFound: number;
    searchRadiusMeters: number;
    queriedAt: string;
  };
}
