export interface ItineraryItemData {
  id: string;
  itineraryDayId: string;
  name: string;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  order: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ItineraryDayData {
  id: string;
  tripId: string;
  dayNumber: number;
  date: string | Date;
  title?: string | null;
  items: ItineraryItemData[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ItineraryItemFormData {
  name: string;
  placeId?: string;
  latitude?: number | null;
  longitude?: number | null;
  startTime?: string;
  endTime?: string;
  notes?: string;
}
