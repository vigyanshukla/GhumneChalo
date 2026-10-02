import { z } from 'zod';

export const idSchema = z
  .string()
  .min(10, 'Invalid ID format')
  .max(128, 'ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID contains invalid characters');

export const coordinateSchema = {
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
};

export const routeCoordinateSchema = z.object({
  lat: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  lng: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  name: z.string().trim().max(200).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const tripCreateSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(100, 'Title cannot exceed 100 characters'),
    destinationName: z.string().trim().min(1, 'Destination is required').max(150, 'Destination name too long'),
    destinationPlaceId: z.string().trim().max(255).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    startDate: z.coerce.date({ message: 'Invalid start date format' }),
    endDate: z.coerce.date({ message: 'Invalid end date format' }),
    totalBudget: z.number().min(0, 'Total budget cannot be negative').optional(),
    currency: z.string().length(3, 'Currency must be a 3-letter code (e.g. INR, USD)').default('INR'),
    status: z.enum(['DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).default('DRAFT'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

export const tripUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    destinationName: z.string().trim().min(1).max(150).optional(),
    destinationPlaceId: z.string().trim().max(255).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    totalBudget: z.number().min(0).nullable().optional(),
    currency: z.string().length(3).optional(),
    status: z.enum(['DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
    isFavorite: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    confirmShorten: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    }
  );

export const savedPlaceCreateSchema = z.object({
  placeId: z.string().trim().min(1, 'Place ID is required').max(255),
  name: z.string().trim().min(1, 'Place name is required').max(150),
  address: z.string().trim().max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  category: z.string().trim().max(50).optional(),
});

export const searchHistoryCreateSchema = z.object({
  query: z.string().trim().min(1, 'Query cannot be empty').max(150, 'Query too long'),
  placeId: z.string().trim().max(255).optional(),
  placeName: z.string().trim().max(150).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const expenseCreateSchema = z.object({
  category: z.enum(['ACCOMMODATION', 'FOOD', 'TRANSPORT', 'ACTIVITIES', 'SHOPPING', 'MISCELLANEOUS']),
  description: z.string().trim().min(1, 'Description is required').max(200),
  amount: z.number().positive('Expense amount must be greater than zero'),
  expenseDate: z.coerce.date().default(() => new Date()),
});

export const transportationCreateSchema = z
  .object({
    type: z.enum(['FLIGHT', 'TRAIN', 'BUS', 'CAR', 'FERRY', 'OTHER']),
    origin: z.string().trim().min(1, 'Origin is required').max(150, 'Origin name too long'),
    destination: z.string().trim().min(1, 'Destination is required').max(150, 'Destination name too long'),
    departureTime: z.coerce.date().optional().nullable(),
    arrivalTime: z.coerce.date().optional().nullable(),
    cost: z.number().min(0, 'Transportation cost cannot be negative').optional().nullable(),
    currency: z.string().length(3, 'Currency must be a 3-letter code').default('INR'),
    notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
    provider: z.string().trim().max(100, 'Provider name too long').optional().nullable(),
    bookingReference: z.string().trim().max(100, 'Booking reference too long').optional().nullable(),
    itineraryDayId: idSchema.optional().nullable(),
    originCoordinates: routeCoordinateSchema.optional().nullable(),
    destinationCoordinates: routeCoordinateSchema.optional().nullable(),
    distanceMeters: z.number().min(0).optional().nullable(),
    durationSeconds: z.number().min(0).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.departureTime && data.arrivalTime) {
        return data.arrivalTime >= data.departureTime;
      }
      return true;
    },
    {
      message: 'Arrival time must be on or after departure time',
      path: ['arrivalTime'],
    }
  );

export const transportationUpdateSchema = z
  .object({
    type: z.enum(['FLIGHT', 'TRAIN', 'BUS', 'CAR', 'FERRY', 'OTHER']).optional(),
    origin: z.string().trim().min(1, 'Origin cannot be empty').max(150).optional(),
    destination: z.string().trim().min(1, 'Destination cannot be empty').max(150).optional(),
    departureTime: z.coerce.date().optional().nullable(),
    arrivalTime: z.coerce.date().optional().nullable(),
    cost: z.number().min(0, 'Transportation cost cannot be negative').optional().nullable(),
    currency: z.string().length(3).optional(),
    notes: z.string().trim().max(500).optional().nullable(),
    provider: z.string().trim().max(100).optional().nullable(),
    bookingReference: z.string().trim().max(100).optional().nullable(),
    itineraryDayId: idSchema.optional().nullable(),
    originCoordinates: routeCoordinateSchema.optional().nullable(),
    destinationCoordinates: routeCoordinateSchema.optional().nullable(),
    distanceMeters: z.number().min(0).optional().nullable(),
    durationSeconds: z.number().min(0).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.departureTime && data.arrivalTime) {
        return data.arrivalTime >= data.departureTime;
      }
      return true;
    },
    {
      message: 'Arrival time must be on or after departure time',
      path: ['arrivalTime'],
    }
  );

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  image: z.string().url('Invalid image URL').max(500).optional(),
});

export const passwordStrengthRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#~_\-\.])[A-Za-z\d@$!%*?&^#~_\-\.]{8,}$/;

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
    email: z.string().trim().email('Invalid email address format').toLowerCase(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(
        passwordStrengthRegex,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(10, 'Invalid or malformed reset token'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(
        passwordStrengthRegex,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(
        passwordStrengthRegex,
        'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password cannot be the same as the current password',
    path: ['newPassword'],
  });

export const verifyEmailSchema = z.object({
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
  otp: z
    .string()
    .trim()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must be numeric'),
});

export const resendOtpSchema = z.object({
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
  type: z
    .enum(['EMAIL_VERIFICATION', 'TWO_FACTOR_LOGIN', 'TWO_FACTOR_SETUP'])
    .default('EMAIL_VERIFICATION'),
});

export const verify2FaSchema = z.object({
  email: z.string().trim().email('Invalid email address format').toLowerCase(),
  otp: z
    .string()
    .trim()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must be numeric'),
  tempToken: z.string().optional(),
});

export const confirm2FaSchema = z.object({
  otp: z
    .string()
    .trim()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must be numeric'),
});

export const disable2FaSchema = z.object({
  password: z.string().optional(),
  otp: z.string().trim().length(6).regex(/^\d{6}$/).optional(),
});


export const travelModeSchema = z.enum(['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT', 'TWO_WHEELER']);

export const routeComputeSchema = z.object({
  origin: routeCoordinateSchema,
  destination: routeCoordinateSchema,
  travelMode: travelModeSchema.default('DRIVE'),
});

export const itineraryDayCreateSchema = z.object({
  dayNumber: z.number().int().min(1, 'Day number must be at least 1').optional(),
  date: z.coerce.date().optional(),
  title: z.string().trim().max(100, 'Title cannot exceed 100 characters').optional().nullable(),
});

export const itineraryDayUpdateSchema = z.object({
  dayNumber: z.number().int().min(1, 'Day number must be at least 1').optional(),
  date: z.coerce.date().optional(),
  title: z.string().trim().max(100, 'Title cannot exceed 100 characters').optional().nullable(),
});

export const itineraryItemCreateSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(150, 'Item name cannot exceed 150 characters'),
  placeId: z.string().trim().max(255).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  startTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM format (e.g. 09:30)')
    .optional()
    .nullable(),
  endTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM format (e.g. 11:30)')
    .optional()
    .nullable(),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const itineraryItemUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(150).optional(),
  placeId: z.string().trim().max(255).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  startTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM format (e.g. 09:30)')
    .optional()
    .nullable(),
  endTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM format (e.g. 11:30)')
    .optional()
    .nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const itineraryItemsReorderSchema = z.object({
  itemIds: z.array(idSchema).min(1, 'At least one item ID is required to reorder'),
});

export const weatherQuerySchema = z
  .object({
    latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
    longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format (YYYY-MM-DD)').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format (YYYY-MM-DD)').optional(),
    refresh: z.enum(['true', 'false']).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    }
  );

import { PACKING_CATEGORIES, type PackingCategory } from './packing/types';
export { PACKING_CATEGORIES, type PackingCategory };

export const packingItemCreateSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(150, 'Item name too long'),
  category: z.enum(PACKING_CATEGORIES).default('ESSENTIALS'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(999, 'Quantity too large').default(1),
  isPacked: z.boolean().optional().default(false),
  notes: z.string().trim().max(500, 'Notes too long').nullable().optional(),
  weatherRelevance: z.string().trim().max(100).nullable().optional(),
});

export const packingItemUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(150, 'Item name too long').optional(),
  category: z.enum(PACKING_CATEGORIES).optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(999, 'Quantity too large').optional(),
  isPacked: z.boolean().optional(),
  notes: z.string().trim().max(500, 'Notes too long').nullable().optional(),
  weatherRelevance: z.string().trim().max(100).nullable().optional(),
});

export const packingGenerateSchema = z.object({
  forceRefreshWeather: z.boolean().optional().default(false),
  preserveCustom: z.boolean().optional().default(true),
});

import { EMERGENCY_CATEGORIES, type EmergencyCategory } from './emergency/types';
export { EMERGENCY_CATEGORIES, type EmergencyCategory };

export const emergencyNearbyQuerySchema = z.object({
  lat: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  type: z.enum(EMERGENCY_CATEGORIES),
  radius: z.coerce.number().int().min(500).max(50000).optional().default(10000),
  limit: z.coerce.number().int().min(1).max(20).optional().default(15),
  tripId: idSchema.optional(),
});

export const achievementUpdateSchema = z.object({
  progress: z.number().int().min(0).max(100),
});


