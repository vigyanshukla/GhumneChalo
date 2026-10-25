import { LucideIcon, Plane, Train, Bus, Car, Ship, Navigation } from 'lucide-react';

export type TransportationType = 'FLIGHT' | 'TRAIN' | 'BUS' | 'CAR' | 'FERRY' | 'OTHER';

export interface RouteCoordinate {
  lat: number;
  lng: number;
  name?: string;
}

export interface TransportationData {
  id: string;
  tripId: string;
  type: TransportationType;
  origin: string;
  destination: string;
  departureTime: string | null;
  arrivalTime: string | null;
  cost: number | null;
  currency: string;
  notes: string | null;
  provider: string | null;
  bookingReference: string | null;
  itineraryDayId: string | null;
  itineraryDay?: {
    id: string;
    dayNumber: number;
    title: string | null;
    date: string | Date;
  } | null;
  originCoordinates?: RouteCoordinate | null;
  destinationCoordinates?: RouteCoordinate | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  formattedDistance: string | null;
  formattedDuration: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface TransportationFormData {
  type: TransportationType;
  origin: string;
  destination: string;
  departureTime?: string;
  arrivalTime?: string;
  cost?: number | null;
  currency?: string;
  notes?: string;
  provider?: string;
  bookingReference?: string;
  itineraryDayId?: string | null;
  originCoordinates?: RouteCoordinate | null;
  destinationCoordinates?: RouteCoordinate | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
}

export const TRANSPORTATION_TYPE_CONFIG: Record<
  TransportationType,
  {
    label: string;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  FLIGHT: {
    label: 'Flight',
    icon: Plane,
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/50',
    borderColor: 'border-sky-200 dark:border-sky-800',
  },
  TRAIN: {
    label: 'Train',
    icon: Train,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/50',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  BUS: {
    label: 'Bus',
    icon: Bus,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  CAR: {
    label: 'Car / Cab',
    icon: Car,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/50',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
  },
  FERRY: {
    label: 'Ferry / Boat',
    icon: Ship,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-950/50',
    borderColor: 'border-teal-200 dark:border-teal-800',
  },
  OTHER: {
    label: 'Transit / Other',
    icon: Navigation,
    color: 'text-zinc-600 dark:text-zinc-400',
    bgColor: 'bg-zinc-100 dark:bg-zinc-800',
    borderColor: 'border-zinc-200 dark:border-zinc-700',
  },
};
