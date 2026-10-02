import crypto from 'crypto';
import { prisma } from './prisma';
import { TooManyRequestsError } from './api-error';

export type SecurityCodeType =
  | 'EMAIL_VERIFICATION'
  | 'TWO_FACTOR_LOGIN'
  | 'TWO_FACTOR_SETUP';

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 * Never uses Math.random().
 */
export function generateNumericOtp(length = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const num = crypto.randomInt(min, max + 1);
  return num.toString();
}

/**
 * Computes a SHA-256 hash of a raw token or OTP for secure database storage.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Constant-time hash comparison to prevent timing attacks.
 */
export function safeCompareHash(hashA: string, hashB: string): boolean {
  if (hashA.length !== hashB.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hashA), Buffer.from(hashB));
}

export interface CreateSecurityCodeOptions {
  email: string;
  type: SecurityCodeType;
  userId?: string | null;
  expiresInMinutes?: number;
  maxAttempts?: number;
  cooldownSeconds?: number;
}

/**
 * Issues a new cryptographically secure security OTP with cooldown enforcement,
 * hashing, and invalidation of any prior codes of the same type.
 */
export async function createSecurityCode({
  email,
  type,
  userId,
  expiresInMinutes = 10,
  maxAttempts = 5,
  cooldownSeconds = 60,
}: CreateSecurityCodeOptions): Promise<{ rawOtp: string; expiresAt: Date }> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check for active cooldown on existing code
  const existing = await prisma.authSecurityCode.findFirst({
    where: {
      email: normalizedEmail,
      type,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    const elapsedSeconds = Math.floor((Date.now() - existing.lastSentAt.getTime()) / 1000);
    if (elapsedSeconds < cooldownSeconds) {
      const remainingSeconds = cooldownSeconds - elapsedSeconds;
      throw new TooManyRequestsError(
        `Please wait ${remainingSeconds} seconds before requesting a new verification code.`
      );
    }
  }

  // 2. Invalidate any existing codes for this email and type
  await prisma.authSecurityCode.deleteMany({
    where: {
      email: normalizedEmail,
      type,
    },
  });

  // 3. Generate secure OTP and hash
  const rawOtp = generateNumericOtp(6);
  const hashedCode = hashToken(rawOtp);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // 4. Persist hashed OTP to database
  await prisma.authSecurityCode.create({
    data: {
      email: normalizedEmail,
      userId: userId || null,
      type,
      hashedCode,
      expiresAt,
      attempts: 0,
      maxAttempts,
      lastSentAt: new Date(),
    },
  });

  return { rawOtp, expiresAt };
}

export interface VerifySecurityCodeResult {
  success: boolean;
  userId?: string | null;
  email?: string;
  reason?: 'NOT_FOUND' | 'EXPIRED' | 'MAX_ATTEMPTS' | 'INVALID_CODE';
  message?: string;
}

/**
 * Verifies a user-supplied OTP against the stored hash.
 * Enforces expiration, attempt limits, and single-use invalidation.
 */
export async function verifySecurityCode(
  email: string,
  type: SecurityCodeType,
  userOtp: string
): Promise<VerifySecurityCodeResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const record = await prisma.authSecurityCode.findFirst({
    where: {
      email: normalizedEmail,
      type,
    },
  });

  if (!record) {
    return {
      success: false,
      reason: 'NOT_FOUND',
      message: 'No active verification code found. Please request a new one.',
    };
  }

  // Check expiration
  if (record.expiresAt < new Date()) {
    await prisma.authSecurityCode.delete({ where: { id: record.id } });
    return {
      success: false,
      reason: 'EXPIRED',
      message: 'Verification code has expired. Please request a new code.',
    };
  }

  // Check max attempts
  if (record.attempts >= record.maxAttempts) {
    await prisma.authSecurityCode.delete({ where: { id: record.id } });
    return {
      success: false,
      reason: 'MAX_ATTEMPTS',
      message: 'Maximum verification attempts exceeded. Code has been invalidated.',
    };
  }

  // Compare hashes
  const userHash = hashToken(userOtp.trim());
  const isMatch = safeCompareHash(record.hashedCode, userHash);

  if (!isMatch) {
    const updatedAttempts = record.attempts + 1;
    if (updatedAttempts >= record.maxAttempts) {
      await prisma.authSecurityCode.delete({ where: { id: record.id } });
      return {
        success: false,
        reason: 'MAX_ATTEMPTS',
        message: 'Maximum verification attempts exceeded. Code has been invalidated.',
      };
    } else {
      await prisma.authSecurityCode.update({
        where: { id: record.id },
        data: { attempts: updatedAttempts },
      });
      const remaining = record.maxAttempts - updatedAttempts;
      return {
        success: false,
        reason: 'INVALID_CODE',
        message: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      };
    }
  }

  // Successful verification: delete immediately for single-use guarantee
  await prisma.authSecurityCode.delete({ where: { id: record.id } });

  return {
    success: true,
    userId: record.userId,
    email: record.email,
  };
}

// =========================================================================
// IN-MEMORY RATE LIMITER FOR AUTH ATTEMPTS
// =========================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Lightweight sliding window rate limiter for login and sensitive auth actions.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count };
}

export function resetRateLimit(key: string): void {
  rateLimitMap.delete(key);
}
