/**
 * GhumneChalo Media Storage Architecture (Phase 12D)
 *
 * Lightweight, secure media management conforming to the principle:
 * "Supabase Storage is OPTIONAL infrastructure only where the product actually benefits
 * from user-uploaded media. Do not store binary files directly in PostgreSQL."
 */

export const MEDIA_CONFIG = {
  MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024, // 2MB max for profile & cover photos
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  ],
  BUCKETS: {
    AVATARS: 'user-avatars',
    TRIP_COVERS: 'trip-covers',
  },
} as const;

export interface MediaUploadValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validates media uploads against allowed MIME types and file size boundaries.
 */
export function validateMediaUpload(
  mimeType: string,
  sizeBytes: number
): MediaUploadValidation {
  if (!MEDIA_CONFIG.ALLOWED_MIME_TYPES.includes(mimeType as typeof MEDIA_CONFIG.ALLOWED_MIME_TYPES[number])) {
    return {
      valid: false,
      error: `Invalid file format: ${mimeType}. Allowed formats are: JPG, PNG, WebP, AVIF.`,
    };
  }

  if (sizeBytes > MEDIA_CONFIG.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 2MB limit (received ${(sizeBytes / (1024 * 1024)).toFixed(2)}MB).`,
    };
  }

  return { valid: true };
}

/**
 * Generates a sanitized, user-isolated storage path preventing cross-user path traversal.
 */
export function generateUserStoragePath(
  userId: string,
  fileName: string,
  bucket: 'user-avatars' | 'trip-covers' = 'user-avatars'
): string {
  // Strip dangerous path traversal characters and directory parts
  const baseName = fileName.split(/[/\\]/).pop() || 'upload';
  const cleanFileName = baseName.replace(/\.{2,}/g, '.').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const timestamp = Date.now();
  return `${bucket}/${userId}/${timestamp}-${cleanFileName}`;
}
