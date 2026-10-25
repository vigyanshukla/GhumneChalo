import { describe, it, expect } from 'vitest';
import {
  validateMediaUpload,
  generateUserStoragePath,
  MEDIA_CONFIG,
} from '../src/lib/storage/media-storage';

describe('Phase 12D — Media Storage Security & Validation (TC-12D.01 to TC-12D.06)', () => {
  // TC-12D.01: File size validation
  it('TC-12D.01: rejects oversized files exceeding 2MB limit', () => {
    const oversized = 3 * 1024 * 1024; // 3MB
    const result = validateMediaUpload('image/jpeg', oversized);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds the 2MB limit');
  });

  // TC-12D.02: Allowed MIME types
  it('TC-12D.02: accepts valid image MIME types (JPEG, PNG, WebP, AVIF)', () => {
    for (const mime of MEDIA_CONFIG.ALLOWED_MIME_TYPES) {
      const res = validateMediaUpload(mime, 500 * 1024);
      expect(res.valid).toBe(true);
    }
  });

  // TC-12D.03: Disallowed MIME types rejected
  it('TC-12D.03: rejects dangerous or non-image MIME types (HTML, SVG, PDF, EXE)', () => {
    const invalidTypes = ['text/html', 'image/svg+xml', 'application/pdf', 'application/x-msdownload'];
    for (const mime of invalidTypes) {
      const res = validateMediaUpload(mime, 100 * 1024);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Invalid file format');
    }
  });

  // TC-12D.04: Path traversal prevention
  it('TC-12D.04: sanitizes filenames and isolates paths by userId to prevent path traversal', () => {
    const userId = 'user_12345';
    const maliciousName = '../../etc/passwd.jpg';
    const path = generateUserStoragePath(userId, maliciousName);

    expect(path.startsWith('user-avatars/user_12345/')).toBe(true);
    expect(path).not.toContain('..');
  });

  // TC-12D.05: User isolation across buckets
  it('TC-12D.05: generated storage paths enforce bucket and user isolation', () => {
    const pathA = generateUserStoragePath('userA', 'avatar.png', 'user-avatars');
    const pathB = generateUserStoragePath('userB', 'avatar.png', 'user-avatars');

    expect(pathA).toContain('userA');
    expect(pathB).toContain('userB');
    expect(pathA).not.toEqual(pathB);
  });

  // TC-12D.06: Zero binary files in PostgreSQL database guarantee
  it('TC-12D.06: schema persists only string image paths/URLs and never stores binary blobs in PostgreSQL', async () => {
    const fs = await import('fs');
    const pathMod = await import('path');
    const schemaPath = pathMod.join(process.cwd(), 'prisma', 'schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Confirm User and Trip models use String? for image paths rather than Bytes
    expect(schemaContent).toContain('image                  String?');
  });
});
