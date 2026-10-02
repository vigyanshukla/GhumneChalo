# VERCEL ENVIRONMENT VARIABLES AUDIT
## GhumneChalo — Smart Wander Platform
**Deployment Target**: Vercel Production  
**Audit Date**: October 2, 2026  
**Auditor**: Senior Full-Stack Performance Architect & Cloud Security Engineer

---

## 1. Environment Variable Inventory & Classification

Every environment variable utilized across the application has been cataloged, classified by exposure scope (SERVER ONLY vs PUBLIC CLIENT), lifecycle phase (BUILD TIME vs RUNTIME), format requirements, and security sensitivity.

| Variable Name | Classification | Lifecycle | Purpose | Exposed to Client? | Security Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **SERVER ONLY** | RUNTIME | Supabase PostgreSQL pooled connection string (port 6543 / transaction mode) | ❌ **NEVER** | **CRITICAL** (Full DB read/write) |
| `DIRECT_URL` | **SERVER ONLY** | BUILD/RUNTIME | Supabase direct connection string (port 5432) for Prisma migrations and schema push | ❌ **NEVER** | **CRITICAL** (Direct DB access) |
| `NEXTAUTH_SECRET` | **SERVER ONLY** | RUNTIME | Symmetric signing key for Auth.js and NextAuth v5 session tokens | ❌ **NEVER** | **CRITICAL** (Session forgery risk if leaked) |
| `AUTH_SECRET` | **SERVER ONLY** | RUNTIME | Canonical Auth.js v5 secret (falls back to `NEXTAUTH_SECRET`) | ❌ **NEVER** | **CRITICAL** (Session signing) |
| `NEXTAUTH_URL` | **SERVER ONLY** | RUNTIME | Canonical root deployment URL (e.g., `https://ghumnechalo.vercel.app`) | ❌ **NEVER** | Low (Public URL; dynamically resolved if omitted) |
| `AUTH_URL` | **SERVER ONLY** | RUNTIME | Canonical Auth.js v5 root URL | ❌ **NEVER** | Low |
| `AUTH_TRUST_HOST` | **SERVER ONLY** | RUNTIME | Boolean (`true`) instructing NextAuth to trust Vercel edge reverse proxies | ❌ **NEVER** | Prevents `UntrustedHost` error |
| `GOOGLE_CLIENT_ID` | **SERVER ONLY** | RUNTIME | Google Cloud OAuth 2.0 Web Client ID | ❌ **NEVER** | Medium |
| `GOOGLE_CLIENT_SECRET` | **SERVER ONLY** | RUNTIME | Google Cloud OAuth 2.0 Web Client Secret | ❌ **NEVER** | **HIGH** (OAuth authentication bypass) |
| `GOOGLE_MAPS_API_KEY` | **SERVER ONLY** | RUNTIME | Unrestricted Google Maps Platform API key (Routes API, Places API New) | ❌ **NEVER** | **HIGH** (Billable Google Cloud API quota) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **PUBLIC CLIENT** | BUILD/RUNTIME | Browser-restricted Google Maps JavaScript SDK key (HTTP referer restricted) | ✅ **YES (Public)** | Safe (Restricted by domain origin in GCP Console) |
| `GOOGLE_CLOUD_PROJECT` | **SERVER ONLY** | RUNTIME | GCP Project ID for Vertex AI Gemini integration | ❌ **NEVER** | Low |
| `GCP_PROJECT_ID` | **SERVER ONLY** | RUNTIME | GCP Project ID alias for Google Auth Library | ❌ **NEVER** | Low |
| `GOOGLE_CLOUD_LOCATION`| **SERVER ONLY** | RUNTIME | Vertex AI region (`us-central1` or `asia-south1`) | ❌ **NEVER** | Low |
| `VERTEX_MODEL` | **SERVER ONLY** | RUNTIME | AI Model designation (`gemini-2.5-flash` or `gemini-1.5-pro`) | ❌ **NEVER** | Low |
| `GCP_SERVICE_ACCOUNT_EMAIL` | **SERVER ONLY** | RUNTIME | IAM Service Account email with Vertex AI User permissions | ❌ **NEVER** | Medium |
| `GCP_PRIVATE_KEY` | **SERVER ONLY** | RUNTIME | RSA Private Key PEM for service account token generation | ❌ **NEVER** | **CRITICAL** (GCP infrastructure access) |
| `SMTP_HOST` | **SERVER ONLY** | RUNTIME | Outbound mail server hostname (e.g., `smtp.resend.com` or `smtp.gmail.com`) | ❌ **NEVER** | Low |
| `SMTP_PORT` | **SERVER ONLY** | RUNTIME | Mail submission port (`465` for SSL, `587` for STARTTLS) | ❌ **NEVER** | Low |
| `SMTP_USER` | **SERVER ONLY** | RUNTIME | Mail authentication username / API key | ❌ **NEVER** | Medium |
| `SMTP_PASSWORD` | **SERVER ONLY** | RUNTIME | Mail authentication password / secret API token | ❌ **NEVER** | **HIGH** (Spam/relay vulnerability if leaked) |
| `SMTP_FROM` | **SERVER ONLY** | RUNTIME | Verified sender envelope address (e.g., `support@ghumnechalo.com`) | ❌ **NEVER** | Low |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **PUBLIC CLIENT** | BUILD/RUNTIME | Web Push VAPID application server public key for browser pushManager | ✅ **YES (Public)** | Safe (Public ECDSA key) |
| `VAPID_PUBLIC_KEY` | **SERVER ONLY** | RUNTIME | Server alias for VAPID public key | ❌ **NEVER** | Safe |
| `VAPID_PRIVATE_KEY` | **SERVER ONLY** | RUNTIME | Web Push VAPID ECDSA private signing key | ❌ **NEVER** | **CRITICAL** (Push spoofing risk) |
| `VAPID_SUBJECT` | **SERVER ONLY** | RUNTIME | VAPID contact email URI (`mailto:support@ghumnechalo.com`) | ❌ **NEVER** | Low |
| `CRON_SECRET` | **SERVER ONLY** | RUNTIME | High-entropy shared bearer secret for Vercel Cron verification | ❌ **NEVER** | **HIGH** (Unauthorized cron invocation protection) |

---

## 2. Client Bundle Secret Leakage Verification

### 2.1 Static Build Bundle Audit
A deep regex inspection of all generated JavaScript chunks in `.next/static/chunks/` confirmed:
- Zero occurrences of `GCP_PRIVATE_KEY` or `BEGIN PRIVATE KEY`.
- Zero occurrences of `DATABASE_URL` or postgres connection strings.
- Zero occurrences of `NEXTAUTH_SECRET` or `AUTH_SECRET`.
- Zero occurrences of `VAPID_PRIVATE_KEY`.
- Zero occurrences of `SMTP_PASSWORD`.
- Zero occurrences of `CRON_SECRET`.
- Zero occurrences of `GOOGLE_CLIENT_SECRET`.

Only variables explicitly prefixed with `NEXT_PUBLIC_` (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) are bundled into client-side code, which is correct and required for client-side Google Maps rendering and Service Worker push subscription registration.

---

## 3. Vercel Project Dashboard Configuration Guide

When adding these variables to the **Vercel Project Settings → Environment Variables**:

1. **Production & Preview Scopes**:
   - `DATABASE_URL` (Supabase pooled URL with `?pgbouncer=true` or pool mode)
   - `DIRECT_URL` (Supabase direct URL)
   - `NEXTAUTH_SECRET` (Generate using `openssl rand -base64 32`)
   - `AUTH_SECRET` (Same as `NEXTAUTH_SECRET`)
   - `AUTH_TRUST_HOST` = `true`
   - `GOOGLE_MAPS_API_KEY` (Server-side key)
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Client-side key with domain restrictions)
   - `CRON_SECRET` (Generate using `openssl rand -hex 32`)
   - `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_PRIVATE_KEY` (Be sure to preserve newline characters in PEM)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

2. **Google Cloud OAuth Redirect URIs**:
   In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client:
   - **Authorized JavaScript origins**:
     `https://your-production-domain.vercel.app`
   - **Authorized redirect URIs**:
     `https://your-production-domain.vercel.app/api/auth/callback/google`
