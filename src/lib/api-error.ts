import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { apiError } from './api-response';

export class AppError extends Error {
  constructor(
    public override message: string,
    public code: string = 'BAD_REQUEST',
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 'BAD_REQUEST', 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden: Access denied to this resource') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists or conflict occurred') {
    super(message, 'CONFLICT', 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 'TOO_MANY_REQUESTS', 429);
  }
}


export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 'VALIDATION_ERROR', 422, details);
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return apiError(error.message, error.code, error.statusCode, error.details);
  }

  if (error instanceof ZodError) {
    const formattedErrors = error.issues.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return apiError('Invalid request parameters', 'VALIDATION_ERROR', 422, formattedErrors);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return apiError('A resource with these unique attributes already exists', 'CONFLICT', 409);
    }
    if (error.code === 'P2025') {
      return apiError('Record to operate on not found', 'NOT_FOUND', 404);
    }
    // Prevent leaking SQL / internal schema info
    return apiError('A database constraint error occurred', 'DATABASE_ERROR', 400);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return apiError('Database service is temporarily unavailable', 'SERVICE_UNAVAILABLE', 500);
  }

  console.error('[Unhandled API Error]:', error);
  return apiError('An unexpected server error occurred', 'INTERNAL_SERVER_ERROR', 500);
}
