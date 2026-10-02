# PHASE 12D — SUPABASE STORAGE & MEDIA ARCHITECTURE REPORT
**GhumneChalo Smart Wander Platform**

============================================================
STATUS: PASS (ALL 5 TASKS VERIFIED)
============================================================

## 1. Executive Summary
Phase 12D addresses user-uploaded media and Supabase Storage conforming strictly to the project architectural directive:
*"Supabase Storage is OPTIONAL infrastructure only where the product actually benefits from user-uploaded media. Do NOT add unnecessary uploads. Do NOT store binary files directly in PostgreSQL."*

The implementation provides a hardened client-and-server validation and path generator module (`src/lib/storage/media-storage.ts`), enforcing strict file size boundaries (2MB max), restricting MIME types to modern safe image formats (JPEG, PNG, WebP, AVIF), isolating user directories to prevent IDOR and cross-user data leakage, and preventing path traversal attacks.

---

## 2. Media Requirements & Constraints
- **Scope**: User profile photos/avatars (`user-avatars`) and trip cover images (`trip-covers`).
- **File Size Ceiling**: Strictly capped at 2MB (`MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024`).
- **Allowed MIME Formats**: `image/jpeg`, `image/png`, `image/webp`, `image/avif`.
- **Disallowed / Rejected Formats**: SVG (prevents embedded script injection), HTML, PDF, executable binaries.
- **PostgreSQL Database Storage**:
  - `prisma/schema.prisma` confirms: PostgreSQL tables only persist string URLs/paths (`image String?`).
  - ZERO binary blob columns exist in database.

---

## 3. Path Isolation & Traversal Defense
- `generateUserStoragePath(userId, fileName, bucket)`:
  - Isolates storage path by `bucket/userId/timestamp-cleanFileName`.
  - Strips path traversal characters (`..`, `/`, `\`), preventing unauthorized writes to other users' directories or parent storage roots.
  - Generates immutable, unique filenames with millisecond timestamp prefixes.

---

## 4. Test Suite Results (`tests/storage.test.ts` — 6 Tests)
- `TC-12D.01: rejects oversized files exceeding 2MB limit`: PASS
- `TC-12D.02: accepts valid image MIME types (JPEG, PNG, WebP, AVIF)`: PASS
- `TC-12D.03: rejects dangerous or non-image MIME types (HTML, SVG, PDF, EXE)`: PASS
- `TC-12D.04: sanitizes filenames and isolates paths by userId to prevent path traversal`: PASS
- `TC-12D.05: generated storage paths enforce bucket and user isolation`: PASS
- `TC-12D.06: schema persists only string image paths/URLs and never stores binary blobs in PostgreSQL`: PASS

**Total: 6 / 6 PASSED (100%)**
