export type TripStatus =
  | 'DRAFT'
  | 'UPCOMING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ARCHIVED';

export interface TripSummary {
  id: string;
  userId: string;
  title: string;
  destinationName: string;
  destinationPlaceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  startDate: string | Date;
  endDate: string | Date;
  totalBudget?: number | null;
  currency: string;
  status: TripStatus;
  isFavorite?: boolean;
  isArchived?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    days?: number;
    expenses?: number;
    transportations?: number;
    packingItems?: number;
  };
}

export interface TripFormData {
  title: string;
  destinationName: string;
  destinationPlaceId?: string;
  latitude?: number | null;
  longitude?: number | null;
  startDate: string;
  endDate: string;
  totalBudget?: number | '';
  currency?: string;
  status?: TripStatus;
}
