import { NormalizedPlace } from '@/components/search';

export interface NormalizedDiscoveryPlace extends NormalizedPlace {
  distanceKm?: number;
  distanceFormatted?: string;
}

export type DiscoveryCategoryKey =
  | 'attractions'
  | 'restaurants'
  | 'cafes'
  | 'hotels'
  | 'museums'
  | 'parks'
  | 'shopping'
  | 'temples';

export interface PopularDestination {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  tagline: string;
}

export const POPULAR_DESTINATIONS: PopularDestination[] = [
  {
    id: 'delhi',
    name: 'New Delhi',
    region: 'Delhi',
    latitude: 28.6139,
    longitude: 77.209,
    tagline: 'Historic Forts & Culture',
  },
  {
    id: 'jaipur',
    name: 'Jaipur',
    region: 'Rajasthan',
    latitude: 26.9124,
    longitude: 75.7873,
    tagline: 'The Pink City & Palaces',
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    region: 'Maharashtra',
    latitude: 19.076,
    longitude: 72.8777,
    tagline: 'Gateway of India & Marine Drive',
  },
  {
    id: 'goa',
    name: 'Goa',
    region: 'Goa',
    latitude: 15.2993,
    longitude: 74.124,
    tagline: 'Beaches & Heritage Churches',
  },
  {
    id: 'agra',
    name: 'Agra',
    region: 'Uttar Pradesh',
    latitude: 27.1751,
    longitude: 78.0421,
    tagline: 'Taj Mahal & Mughal Marvels',
  },
  {
    id: 'varanasi',
    name: 'Varanasi',
    region: 'Uttar Pradesh',
    latitude: 25.3176,
    longitude: 82.9739,
    tagline: 'Ghats & Spiritual Heartland',
  },
  {
    id: 'manali',
    name: 'Manali',
    region: 'Himachal Pradesh',
    latitude: 32.2432,
    longitude: 77.1892,
    tagline: 'Snowy Peaks & Alpine Valleys',
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    region: 'Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
    tagline: 'Garden City & Cafe Culture',
  },
];
